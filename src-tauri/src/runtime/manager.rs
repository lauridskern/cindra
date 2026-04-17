use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Arc;

use anyhow::Context;
use tokio::sync::{Mutex, mpsc};
use uuid::Uuid;

use crate::bridge::emitter::UiEventEmitter;
use crate::bridge::followup::FollowupBridge;
use crate::desktop_open;
use crate::dto::{
    FollowupRequestDto, FollowupResponseDto, RuntimeStatusDto, SendPromptInput, SessionMessageDto,
    SessionSnapshotDto,
};
use crate::persistence::project_store::ProjectStore;

use super::{
    ConversationSessionState, MISSING_SESSION_MESSAGE, RuntimeFactory, RuntimeState,
    WorkspaceSessionState, build_snapshot, canonicalize_workspace_path,
    configuration_error_message, create_conversation_record, create_message_id,
    derive_conversation_title_from_messages, read_config, select_empty_draft_conversation_id,
    shared_runtime_state, workspace_name,
};

#[derive(Clone)]
pub struct RuntimeManager {
    pub(super) emitter: Arc<dyn UiEventEmitter>,
    pub(super) followups: Arc<FollowupBridge>,
    pub(super) projects: Arc<ProjectStore>,
    pub(super) state: Arc<Mutex<RuntimeState>>,
    pub(super) factory: Arc<RuntimeFactory>,
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

    pub async fn handle_followup_requests(
        self: Arc<Self>,
        mut receiver: mpsc::UnboundedReceiver<FollowupRequestDto>,
    ) {
        while let Some(request) = receiver.recv().await {
            {
                let mut state = self.state.lock().await;
                state
                    .pending_followups_by_conversation
                    .insert(request.conversation_id.clone(), request);
                state.ui_error = None;
            }

            let _ = self.emit_session_snapshot().await;
        }
    }

    pub async fn get_runtime_status(&self) -> anyhow::Result<RuntimeStatusDto> {
        self.ensure_known_workspaces_loaded().await?;

        let state = self.state.lock().await;
        if let Some(workspace_path) = state.active_workspace_path.as_ref() {
            let workspace = state
                .workspaces
                .get(workspace_path)
                .context("Active workspace is not loaded.")?;
            return Ok(RuntimeStatusDto::new(
                Some(Path::new(workspace_path)),
                workspace.configured,
                workspace.configuration_error.clone(),
            ));
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
        let result: anyhow::Result<RuntimeStatusDto> = async {
            let workspace_path = self.current_workspace_path().await?;
            let branch_name = validate_non_empty_value(&branch_name, "Branch name")?;

            if git_ref_exists(&workspace_path, &format!("refs/heads/{branch_name}"))? {
                run_git_command(&workspace_path, &["checkout", &branch_name], "git checkout")?;
            } else if git_ref_exists(&workspace_path, &format!("refs/remotes/{branch_name}"))? {
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
            } else {
                run_git_command(&workspace_path, &["checkout", &branch_name], "git checkout")?;
            }

            self.clear_ui_error().await?;
            self.get_runtime_status().await
        }
        .await;

        if let Err(error) = &result {
            let _ = self.record_ui_error(&error.to_string()).await;
        }

        result
    }

    pub async fn create_git_branch(
        &self,
        branch_name: String,
    ) -> anyhow::Result<RuntimeStatusDto> {
        let result: anyhow::Result<RuntimeStatusDto> = async {
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

            self.clear_ui_error().await?;
            self.get_runtime_status().await
        }
        .await;

        if let Err(error) = &result {
            let _ = self.record_ui_error(&error.to_string()).await;
        }

        result
    }

    pub async fn commit_git_changes(&self, message: String) -> anyhow::Result<RuntimeStatusDto> {
        let result: anyhow::Result<RuntimeStatusDto> = async {
            let workspace_path = self.current_workspace_path().await?;
            let message = validate_non_empty_value(&message, "Commit message")?;

            run_git_command(&workspace_path, &["add", "-A"], "git add")?;
            run_git_command(&workspace_path, &["commit", "-m", &message], "git commit")?;

            self.clear_ui_error().await?;
            self.get_runtime_status().await
        }
        .await;

        if let Err(error) = &result {
            let _ = self.record_ui_error(&error.to_string()).await;
        }

        result
    }

    pub async fn push_git_branch(&self) -> anyhow::Result<RuntimeStatusDto> {
        let result: anyhow::Result<RuntimeStatusDto> = async {
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

            self.clear_ui_error().await?;
            self.get_runtime_status().await
        }
        .await;

        if let Err(error) = &result {
            let _ = self.record_ui_error(&error.to_string()).await;
        }

        result
    }

    pub async fn open_in_target(&self, target_id: String) -> anyhow::Result<()> {
        let result: anyhow::Result<()> = async {
            let workspace_path = self.current_workspace_path().await?;
            let target_id = validate_non_empty_value(&target_id, "Open target")?;
            desktop_open::open_path_in_target(&target_id, workspace_path.as_path())?;
            self.clear_ui_error().await?;
            Ok(())
        }
        .await;

        if let Err(error) = &result {
            let _ = self.record_ui_error(&error.to_string()).await;
        }

        result
    }

    pub async fn get_session_snapshot(&self) -> anyhow::Result<SessionSnapshotDto> {
        match self.snapshot().await {
            Ok(snapshot) => Ok(snapshot),
            Err(error) => {
                let message = error.to_string();
                let _ = self.record_ui_error(&message).await;
                Err(error)
            }
        }
    }

    pub async fn open_workspace(&self, path: PathBuf) -> anyhow::Result<SessionSnapshotDto> {
        let result: anyhow::Result<SessionSnapshotDto> = async {
            let workspace_path = canonicalize_workspace_path(path)?;
            self.projects.add_project(Path::new(&workspace_path))?;
            self.ensure_workspace_runtime(&workspace_path).await?;
            self.refresh_workspace_conversations(&workspace_path)
                .await?;

            let selected_conversation_id = {
                let mut state = self.state.lock().await;
                state.active_workspace_path = Some(workspace_path.clone());
                state.ui_error = None;
                state
                    .workspaces
                    .get(&workspace_path)
                    .and_then(|workspace| workspace.selected_conversation_id.clone())
            };

            if let Some(conversation_id) = selected_conversation_id {
                self.ensure_conversation_loaded(&workspace_path, &conversation_id)
                    .await?;
            }

            let snapshot = self.snapshot().await?;
            self.emit_snapshot(snapshot.clone())?;
            Ok(snapshot)
        }
        .await;

        if let Err(error) = &result {
            let _ = self.record_ui_error(&error.to_string()).await;
        }

        result
    }

    pub async fn select_conversation(
        &self,
        workspace_path: String,
        conversation_id: String,
    ) -> anyhow::Result<SessionSnapshotDto> {
        let result: anyhow::Result<SessionSnapshotDto> = async {
            let workspace_path = canonicalize_workspace_path(PathBuf::from(workspace_path))?;
            self.projects.add_project(Path::new(&workspace_path))?;
            self.ensure_workspace_runtime(&workspace_path).await?;
            self.refresh_workspace_conversations(&workspace_path)
                .await?;
            self.ensure_conversation_loaded(&workspace_path, &conversation_id)
                .await?;

            {
                let mut state = self.state.lock().await;
                state.active_workspace_path = Some(workspace_path.clone());
                state.ui_error = None;
                let workspace = state
                    .workspaces
                    .entry(workspace_path.clone())
                    .or_insert_with(|| WorkspaceSessionState {
                        workspace_name: workspace_name(Path::new(&workspace_path)),
                        ..WorkspaceSessionState::default()
                    });
                workspace.selected_conversation_id = Some(conversation_id);
            }

            let snapshot = self.snapshot().await?;
            self.emit_snapshot(snapshot.clone())?;
            Ok(snapshot)
        }
        .await;

        if let Err(error) = &result {
            let _ = self.record_ui_error(&error.to_string()).await;
        }

        result
    }

    pub async fn start_new_chat(
        &self,
        workspace_path: String,
    ) -> anyhow::Result<SessionSnapshotDto> {
        let result: anyhow::Result<SessionSnapshotDto> = async {
            let workspace_path = canonicalize_workspace_path(PathBuf::from(workspace_path))?;
            self.projects.add_project(Path::new(&workspace_path))?;
            let runtime = self.ensure_workspace_runtime(&workspace_path).await?;
            self.refresh_workspace_conversations(&workspace_path)
                .await?;

            let maybe_existing = {
                let state = self.state.lock().await;
                select_empty_draft_conversation_id(&state, &workspace_path)
            };

            let conversation_id = if let Some(existing) = maybe_existing {
                existing
            } else {
                let mut current = None;
                let created =
                    create_conversation_record(runtime.api.as_ref(), &mut current).await?;
                self.refresh_workspace_conversations(&workspace_path)
                    .await?;
                let created_id = created.into_string();

                let mut state = self.state.lock().await;
                let order = state.allocate_order();
                state
                    .conversations
                    .entry(created_id.clone())
                    .or_insert_with(|| ConversationSessionState {
                        workspace_path: workspace_path.clone(),
                        messages: Vec::new(),
                        title: Some("New chat".to_string()),
                        updated_at: None,
                        active_request_ids: Vec::new(),
                        is_local_draft: true,
                        order,
                    });
                created_id
            };

            {
                let mut state = self.state.lock().await;
                state.active_workspace_path = Some(workspace_path.clone());
                state.ui_error = None;
                let workspace = state
                    .workspaces
                    .entry(workspace_path.clone())
                    .or_insert_with(|| WorkspaceSessionState {
                        workspace_name: workspace_name(Path::new(&workspace_path)),
                        ..WorkspaceSessionState::default()
                    });
                workspace.selected_conversation_id = Some(conversation_id);
            }

            let snapshot = self.snapshot().await?;
            self.emit_snapshot(snapshot.clone())?;
            Ok(snapshot)
        }
        .await;

        if let Err(error) = &result {
            let _ = self.record_ui_error(&error.to_string()).await;
        }

        result
    }

    pub async fn send_prompt(&self, input: SendPromptInput) -> anyhow::Result<SessionSnapshotDto> {
        let result: anyhow::Result<SessionSnapshotDto> = async {
            let workspace_path =
                canonicalize_workspace_path(PathBuf::from(input.workspace_path.trim()))?;
            self.projects.add_project(Path::new(&workspace_path))?;

            let prompt = input.prompt.trim().to_string();
            if prompt.is_empty() {
                anyhow::bail!("Prompt cannot be empty.");
            }

            let runtime = self.ensure_workspace_runtime(&workspace_path).await?;
            self.refresh_workspace_conversations(&workspace_path)
                .await?;

            if runtime.config.session.is_none() {
                anyhow::bail!(
                    "{}",
                    runtime
                        .configuration_error
                        .clone()
                        .unwrap_or_else(|| MISSING_SESSION_MESSAGE.to_string())
                );
            }

            let mut conversation_id = if let Some(conversation_id) = input.conversation_id.clone() {
                conversation_id
            } else {
                let state = self.state.lock().await;
                state
                    .workspaces
                    .get(&workspace_path)
                    .and_then(|workspace| workspace.selected_conversation_id.clone())
                    .or_else(|| select_empty_draft_conversation_id(&state, &workspace_path))
                    .unwrap_or_default()
            };

            if conversation_id.is_empty() {
                let mut current = None;
                let created =
                    create_conversation_record(runtime.api.as_ref(), &mut current).await?;
                conversation_id = created.into_string();
                self.refresh_workspace_conversations(&workspace_path)
                    .await?;
            }

            self.ensure_conversation_loaded_or_insert_empty(&workspace_path, &conversation_id)
                .await?;

            let request_id = Uuid::new_v4().to_string();

            {
                let mut state = self.state.lock().await;
                let is_running = state
                    .conversations
                    .get(&conversation_id)
                    .map(|conversation| !conversation.active_request_ids.is_empty())
                    .unwrap_or(false);
                if is_running {
                    anyhow::bail!("This chat is already running.");
                }

                let order = state.allocate_order();
                let conversation = state
                    .conversations
                    .entry(conversation_id.clone())
                    .or_insert_with(|| ConversationSessionState {
                        workspace_path: workspace_path.clone(),
                        messages: Vec::new(),
                        title: Some("New chat".to_string()),
                        updated_at: None,
                        active_request_ids: Vec::new(),
                        is_local_draft: true,
                        order,
                    });

                conversation.workspace_path = workspace_path.clone();
                conversation.active_request_ids.push(request_id.clone());
                conversation.is_local_draft = false;
                conversation.order = order;
                conversation.messages.push(SessionMessageDto::User {
                    id: create_message_id("user", &request_id, conversation.messages.len()),
                    request_id: request_id.clone(),
                    text: prompt.clone(),
                });
                conversation.title = Some(derive_conversation_title_from_messages(
                    &conversation.messages,
                ));

                let workspace = state
                    .workspaces
                    .entry(workspace_path.clone())
                    .or_insert_with(|| WorkspaceSessionState {
                        workspace_name: workspace_name(Path::new(&workspace_path)),
                        ..WorkspaceSessionState::default()
                    });
                workspace.selected_conversation_id = Some(conversation_id.clone());
                state.active_workspace_path = Some(workspace_path.clone());
                state
                    .pending_followups_by_conversation
                    .remove(&conversation_id);
                state.ui_error = None;
            }

            let snapshot = self.snapshot().await?;
            self.emit_snapshot(snapshot.clone())?;

            let manager = self.clone();
            tauri::async_runtime::spawn(async move {
                manager
                    .stream_chat(runtime, workspace_path, request_id, conversation_id, prompt)
                    .await;
            });

            Ok(snapshot)
        }
        .await;

        if let Err(error) = &result {
            let _ = self.record_ui_error(&error.to_string()).await;
        }

        result
    }

    pub async fn respond_followup(
        &self,
        response: FollowupResponseDto,
    ) -> anyhow::Result<SessionSnapshotDto> {
        let result: anyhow::Result<SessionSnapshotDto> = async {
            self.followups.respond(response.clone()).await?;

            {
                let mut state = self.state.lock().await;
                let conversation_id = state.pending_followups_by_conversation.iter().find_map(
                    |(conversation_id, request)| {
                        (request.followup_id == response.followup_id)
                            .then_some(conversation_id.clone())
                    },
                );
                if let Some(conversation_id) = conversation_id {
                    state
                        .pending_followups_by_conversation
                        .remove(&conversation_id);
                }
                state.ui_error = None;
            }

            let snapshot = self.snapshot().await?;
            self.emit_snapshot(snapshot.clone())?;
            Ok(snapshot)
        }
        .await;

        if let Err(error) = &result {
            let _ = self.record_ui_error(&error.to_string()).await;
        }

        result
    }

    pub async fn cancel_pending_followups(&self) {
        self.followups.cancel_all().await;
        let mut state = self.state.lock().await;
        state.pending_followups_by_conversation.clear();
    }

    pub(super) async fn snapshot(&self) -> anyhow::Result<SessionSnapshotDto> {
        self.ensure_known_workspaces_loaded().await?;
        let state = self.state.lock().await;
        Ok(build_snapshot(&state))
    }

    pub(super) async fn emit_session_snapshot(&self) -> anyhow::Result<()> {
        let snapshot = self.snapshot().await?;
        self.emit_snapshot(snapshot)
    }

    pub(super) fn emit_snapshot(&self, snapshot: SessionSnapshotDto) -> anyhow::Result<()> {
        self.emitter.emit_session_updated(snapshot)
    }

    async fn record_ui_error(&self, message: &str) -> anyhow::Result<()> {
        let snapshot = {
            let mut state = self.state.lock().await;
            state.ui_error = Some(message.to_string());
            build_snapshot(&state)
        };

        self.emit_snapshot(snapshot)
    }

    async fn clear_ui_error(&self) -> anyhow::Result<()> {
        let snapshot = {
            let mut state = self.state.lock().await;
            if state.ui_error.is_none() {
                return Ok(());
            }
            state.ui_error = None;
            build_snapshot(&state)
        };

        self.emit_snapshot(snapshot)
    }

    async fn current_workspace_path(&self) -> anyhow::Result<PathBuf> {
        self.ensure_known_workspaces_loaded().await?;
        let state = self.state.lock().await;
        let workspace_path = state
            .active_workspace_path
            .as_ref()
            .cloned()
            .context("Open a workspace before running git actions.")?;

        let has_running_request = state.conversations.values().any(|conversation| {
            conversation.workspace_path == workspace_path
                && !conversation.active_request_ids.is_empty()
        });
        if has_running_request {
            anyhow::bail!("Wait for the current run to finish before running git actions.");
        }

        Ok(PathBuf::from(workspace_path))
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
