use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Arc;

use anyhow::Context;
use forge_api::API;
use forge_domain::{ChatRequest, ChatResponse, ConversationId, Event};
use futures::StreamExt;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::bridge::emitter::UiEventEmitter;
use crate::bridge::followup::FollowupBridge;
use crate::desktop_open;
use crate::dto::{
    ChatEventDto, ChatEventKind, ConversationTranscriptDto, FollowupResponseDto, ProjectSummaryDto,
    ResetChatResultDto, RuntimeStatusDto, SendPromptInput, SendPromptResultDto,
};
use crate::persistence::project_store::ProjectStore;

use super::{
    ForgeRuntime, RuntimeFactory, RuntimeState, configuration_error_message,
    create_conversation_record, read_config, resolve_conversation_id, shared_runtime_state,
};

#[derive(Clone)]
pub struct RuntimeManager {
    emitter: Arc<dyn UiEventEmitter>,
    followups: Arc<FollowupBridge>,
    projects: Arc<ProjectStore>,
    state: Arc<Mutex<RuntimeState>>,
    factory: Arc<RuntimeFactory>,
}

impl RuntimeManager {
    pub(crate) fn new(
        emitter: Arc<dyn UiEventEmitter>,
        followups: Arc<FollowupBridge>,
        projects: Arc<ProjectStore>,
    ) -> Self {
        Self {
            emitter,
            followups: followups.clone(),
            projects,
            state: shared_runtime_state(),
            factory: Arc::new(RuntimeFactory::new(followups)),
        }
    }

    pub async fn open_workspace(&self, path: PathBuf) -> anyhow::Result<RuntimeStatusDto> {
        let (config, configuration_error) = read_config();
        self.open_workspace_with_config(path, config, configuration_error)
            .await
    }

    pub(crate) async fn open_workspace_with_config(
        &self,
        path: PathBuf,
        config: forge_config::ForgeConfig,
        configuration_error: Option<String>,
    ) -> anyhow::Result<RuntimeStatusDto> {
        self.followups.cancel_all().await;
        self.projects.add_project(path.as_path())?;

        let runtime = self
            .factory
            .build_runtime(path.clone(), config, configuration_error)
            .await?;
        let status = runtime.status(Some(path.as_path())).await?;

        let mut state = self.state.lock().await;
        state.workspace_path = Some(path);
        state.runtime = Some(runtime);
        state.conversation_id = None;
        state.active_request_id = None;

        Ok(status)
    }

    pub async fn get_runtime_status(&self) -> anyhow::Result<RuntimeStatusDto> {
        let snapshot = self.state.lock().await.clone();
        if let Some(runtime) = snapshot.runtime {
            return runtime.status(snapshot.workspace_path.as_deref()).await;
        }

        let (config, configuration_error) = read_config();
        Ok(RuntimeStatusDto::new(
            None,
            config.session.is_some(),
            configuration_error_message(config.session.is_some(), configuration_error),
        ))
    }

    pub async fn checkout_git_branch(
        &self,
        branch_name: String,
    ) -> anyhow::Result<RuntimeStatusDto> {
        let workspace_path = self.current_workspace_path().await?;
        let branch_name = validate_non_empty_value(&branch_name, "Branch name")?;

        if git_ref_exists(&workspace_path, &format!("refs/heads/{branch_name}"))? {
            run_git_command(&workspace_path, &["checkout", &branch_name], "git checkout")?;
            return self.get_runtime_status().await;
        }

        if git_ref_exists(&workspace_path, &format!("refs/remotes/{branch_name}"))? {
            let local_branch_name = branch_name
                .rsplit('/')
                .next()
                .filter(|candidate| !candidate.is_empty())
                .unwrap_or(branch_name.as_str());

            if git_ref_exists(&workspace_path, &format!("refs/heads/{local_branch_name}"))? {
                run_git_command(
                    &workspace_path,
                    &["checkout", local_branch_name],
                    "git checkout",
                )?;
            } else {
                run_git_command(
                    &workspace_path,
                    &["checkout", "--track", &branch_name],
                    "git checkout --track",
                )?;
            }

            return self.get_runtime_status().await;
        }

        run_git_command(&workspace_path, &["checkout", &branch_name], "git checkout")?;
        self.get_runtime_status().await
    }

    pub async fn create_git_branch(&self, branch_name: String) -> anyhow::Result<RuntimeStatusDto> {
        let workspace_path = self.current_workspace_path().await?;
        let branch_name = validate_non_empty_value(&branch_name, "Branch name")?;

        run_git_command(
            &workspace_path,
            &["check-ref-format", "--branch", &branch_name],
            "git check-ref-format",
        )?;
        run_git_command(
            &workspace_path,
            &["checkout", "-b", &branch_name],
            "git checkout -b",
        )?;

        self.get_runtime_status().await
    }

    pub async fn commit_git_changes(&self, message: String) -> anyhow::Result<RuntimeStatusDto> {
        let workspace_path = self.current_workspace_path().await?;
        let message = validate_non_empty_value(&message, "Commit message")?;

        run_git_command(&workspace_path, &["add", "-A"], "git add")?;
        run_git_command(&workspace_path, &["commit", "-m", &message], "git commit")?;

        self.get_runtime_status().await
    }

    pub async fn push_git_branch(&self) -> anyhow::Result<RuntimeStatusDto> {
        let workspace_path = self.current_workspace_path().await?;
        let current_branch = run_git_stdout(
            &workspace_path,
            &["rev-parse", "--abbrev-ref", "HEAD"],
            "git rev-parse",
        )?;

        if current_branch == "HEAD" {
            anyhow::bail!("Cannot push from a detached HEAD state.");
        }

        if git_command_succeeds(
            &workspace_path,
            &[
                "rev-parse",
                "--abbrev-ref",
                "--symbolic-full-name",
                "@{upstream}",
            ],
        )? {
            run_git_command(&workspace_path, &["push"], "git push")?;
        } else {
            run_git_command(
                &workspace_path,
                &["push", "-u", "origin", &current_branch],
                "git push -u",
            )?;
        }

        self.get_runtime_status().await
    }

    pub async fn open_in_target(&self, target_id: String) -> anyhow::Result<()> {
        let workspace_path = self.current_workspace_path().await?;
        let target_id = validate_non_empty_value(&target_id, "Open target")?;
        desktop_open::open_path_in_target(&target_id, workspace_path.as_path())
    }

    pub async fn list_projects(&self) -> anyhow::Result<Vec<ProjectSummaryDto>> {
        let (runtime, current_path, config, configuration_error) = {
            let state = self.state.lock().await;
            let runtime = state.runtime.clone();
            let current_path = state.workspace_path.clone();

            let (config, configuration_error) = runtime
                .as_ref()
                .map(|runtime| (runtime.config.clone(), runtime.configuration_error.clone()))
                .unwrap_or_else(read_config);

            (runtime, current_path, config, configuration_error)
        };

        let project_paths = self.projects.list_projects()?;
        let project_groups =
            futures::future::join_all(project_paths.into_iter().map(|workspace_path| {
                let config = config.clone();
                let configuration_error = configuration_error.clone();
                let current_runtime = runtime.clone();
                let current_path = current_path.clone();
                let factory = self.factory.clone();

                async move {
                    let project_runtime = if current_path.as_ref() == Some(&workspace_path) {
                        current_runtime
                    } else {
                        factory
                            .build_runtime(workspace_path.clone(), config, configuration_error)
                            .await
                            .ok()
                    }?;
                    let conversations = project_runtime.api.get_conversations(None).await.ok()?;
                    Some(ProjectSummaryDto::new(
                        workspace_path.as_path(),
                        &conversations,
                    ))
                }
            }))
            .await;

        Ok(project_groups.into_iter().flatten().collect())
    }

    pub async fn load_conversation(
        &self,
        conversation_id: String,
    ) -> anyhow::Result<ConversationTranscriptDto> {
        let parsed = ConversationId::parse(&conversation_id)?;
        let runtime = {
            let state = self.state.lock().await;
            state
                .runtime
                .clone()
                .context("Open a workspace before loading a conversation.")?
        };

        let conversation = runtime
            .api
            .conversation(&parsed)
            .await?
            .context("Conversation not found.")?;

        let mut state = self.state.lock().await;
        state.conversation_id = Some(parsed);

        Ok(ConversationTranscriptDto::from_conversation(&conversation))
    }

    pub async fn send_prompt(&self, input: SendPromptInput) -> anyhow::Result<SendPromptResultDto> {
        let prompt = input.prompt.trim().to_string();
        if prompt.is_empty() {
            anyhow::bail!("Prompt cannot be empty.");
        }

        let (runtime, conversation_id, request_id) = {
            let mut state = self.state.lock().await;
            if state.active_request_id.is_some() {
                anyhow::bail!("A Forge run is already active.");
            }

            let runtime = state
                .runtime
                .clone()
                .context("Open a workspace before sending a prompt.")?;

            if runtime.config.session.is_none() {
                anyhow::bail!(
                    "{}",
                    runtime
                        .configuration_error
                        .clone()
                        .unwrap_or_else(|| { super::MISSING_SESSION_MESSAGE.to_string() })
                );
            }

            let conversation_id = resolve_conversation_id(
                runtime.api.as_ref(),
                &mut state.conversation_id,
                input.conversation_id.as_deref(),
            )
            .await?;

            let request_id = Uuid::new_v4().to_string();
            state.active_request_id = Some(request_id.clone());

            (runtime, conversation_id, request_id)
        };

        let manager = self.clone();
        let prompt_for_task = prompt.clone();
        let request_id_for_task = request_id.clone();
        tauri::async_runtime::spawn(async move {
            manager
                .stream_chat(
                    runtime,
                    request_id_for_task,
                    conversation_id,
                    prompt_for_task,
                )
                .await;
        });

        Ok(SendPromptResultDto {
            request_id,
            conversation_id: conversation_id.into_string(),
        })
    }

    pub async fn respond_followup(&self, response: FollowupResponseDto) -> anyhow::Result<()> {
        self.followups.respond(response).await
    }

    pub async fn reset_chat(&self) -> anyhow::Result<ResetChatResultDto> {
        let conversation_id = {
            let mut state = self.state.lock().await;
            if state.active_request_id.is_some() {
                anyhow::bail!("Cannot reset the chat while Forge is running.");
            }

            let runtime = state
                .runtime
                .clone()
                .context("Open a workspace before starting a new chat.")?;

            create_conversation_record(runtime.api.as_ref(), &mut state.conversation_id).await?
        };

        Ok(ResetChatResultDto {
            conversation_id: conversation_id.into_string(),
        })
    }

    pub async fn cancel_pending_followups(&self) {
        self.followups.cancel_all().await;
    }

    async fn finish_request(&self, request_id: &str) {
        let mut state = self.state.lock().await;
        if state.active_request_id.as_deref() == Some(request_id) {
            state.active_request_id = None;
        }
    }

    async fn stream_chat(
        &self,
        runtime: ForgeRuntime,
        request_id: String,
        conversation_id: ConversationId,
        prompt: String,
    ) {
        let _ = self.emitter.emit_chat(ChatEventDto::new(
            request_id.clone(),
            conversation_id,
            ChatEventKind::Started,
        ));

        let stream = match runtime
            .api
            .chat(ChatRequest::new(Event::new(prompt), conversation_id))
            .await
        {
            Ok(stream) => stream,
            Err(error) => {
                self.emit_error(&request_id, conversation_id, error.to_string());
                self.finish_request(&request_id).await;
                return;
            }
        };

        tokio::pin!(stream);
        let mut saw_complete = false;

        while let Some(item) = stream.next().await {
            match item {
                Ok(response) => {
                    if let Some(event) = crate::dto::map_chat_response(&response) {
                        if matches!(event, ChatEventKind::Complete) {
                            saw_complete = true;
                        }
                        let _ = self.emitter.emit_chat(ChatEventDto::new(
                            request_id.clone(),
                            conversation_id,
                            event,
                        ));
                    }

                    if let ChatResponse::ToolCallStart { notifier, .. } = &response {
                        notifier.notify_one();
                    }
                }
                Err(error) => {
                    self.emit_error(&request_id, conversation_id, error.to_string());
                    self.finish_request(&request_id).await;
                    return;
                }
            }
        }

        if !saw_complete {
            let _ = self.emitter.emit_chat(ChatEventDto::new(
                request_id.clone(),
                conversation_id,
                ChatEventKind::Complete,
            ));
        }

        self.finish_request(&request_id).await;
    }

    fn emit_error(&self, request_id: &str, conversation_id: ConversationId, message: String) {
        let _ = self.emitter.emit_chat(ChatEventDto::new(
            request_id.to_string(),
            conversation_id,
            ChatEventKind::Error { message },
        ));
    }
}

impl RuntimeManager {
    async fn current_workspace_path(&self) -> anyhow::Result<PathBuf> {
        let state = self.state.lock().await;
        if state.active_request_id.is_some() {
            anyhow::bail!("Wait for the current run to finish before running git actions.");
        }

        state
            .workspace_path
            .clone()
            .context("Open a workspace before running git actions.")
    }
}

fn validate_non_empty_value(value: &str, label: &str) -> anyhow::Result<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        anyhow::bail!("{label} cannot be empty.");
    }

    Ok(trimmed.to_string())
}

fn git_ref_exists(workspace_path: &Path, reference: &str) -> anyhow::Result<bool> {
    let output = Command::new("git")
        .args(["show-ref", "--verify", "--quiet", reference])
        .current_dir(workspace_path)
        .output()
        .with_context(|| "Failed to launch git. Make sure git is installed.")?;

    Ok(output.status.success())
}

fn git_command_succeeds(workspace_path: &Path, args: &[&str]) -> anyhow::Result<bool> {
    let output = Command::new("git")
        .args(args)
        .current_dir(workspace_path)
        .output()
        .with_context(|| "Failed to launch git. Make sure git is installed.")?;

    Ok(output.status.success())
}

fn run_git_stdout(
    workspace_path: &Path,
    args: &[&str],
    description: &str,
) -> anyhow::Result<String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(workspace_path)
        .output()
        .with_context(|| format!("Failed to launch {description}. Make sure git is installed."))?;

    if output.status.success() {
        let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !value.is_empty() {
            return Ok(value);
        }
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if !stderr.is_empty() {
        anyhow::bail!("{stderr}");
    }

    anyhow::bail!("{description} failed.")
}

fn run_git_command(workspace_path: &Path, args: &[&str], description: &str) -> anyhow::Result<()> {
    let output = Command::new("git")
        .args(args)
        .current_dir(workspace_path)
        .output()
        .with_context(|| format!("Failed to launch {description}. Make sure git is installed."))?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if !stderr.is_empty() {
        anyhow::bail!("{stderr}");
    }
    if !stdout.is_empty() {
        anyhow::bail!("{stdout}");
    }

    anyhow::bail!("{description} failed.")
}
