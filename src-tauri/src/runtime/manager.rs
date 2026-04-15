use std::path::PathBuf;
use std::sync::Arc;

use anyhow::Context;
use forge_api::API;
use forge_domain::{ChatRequest, ChatResponse, ConversationId, Event};
use futures::StreamExt;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::bridge::emitter::UiEventEmitter;
use crate::bridge::followup::FollowupBridge;
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

#[cfg(test)]
mod tests {
    use forge_config::{ForgeConfig, ModelConfig};
    use forge_domain::{Conversation, ConversationId};
    use tempfile::TempDir;
    use tokio::sync::Mutex;

    use super::*;
    use crate::bridge::emitter::MemoryEventEmitter;
    use crate::test_support::{EnvGuard, create_project_store};

    #[derive(Default)]
    struct FakeConversationApi {
        upserts: Mutex<Vec<ConversationId>>,
    }

    #[async_trait::async_trait]
    impl super::super::factory::ConversationUpserter for FakeConversationApi {
        async fn upsert_conversation_record(
            &self,
            conversation: Conversation,
        ) -> anyhow::Result<()> {
            self.upserts.lock().await.push(conversation.id);
            Ok(())
        }
    }

    #[tokio::test]
    async fn first_prompt_creates_and_persists_a_conversation_then_reuses_it() {
        let api = FakeConversationApi::default();
        let mut current = None;

        let first = resolve_conversation_id(&api, &mut current, None)
            .await
            .expect("first conversation");
        let second = resolve_conversation_id(&api, &mut current, None)
            .await
            .expect("second conversation");

        assert_eq!(first, second);
        assert_eq!(api.upserts.lock().await.len(), 1);
    }

    #[tokio::test]
    async fn open_workspace_initializes_runtime_and_returns_status() {
        let forge_home = TempDir::new().expect("forge home");
        let workspace = TempDir::new().expect("workspace");
        let _guard = EnvGuard::set_config_dir(forge_home.path());
        let emitter = Arc::new(MemoryEventEmitter::default());
        let followups = Arc::new(FollowupBridge::new(emitter.clone()));
        let manager = RuntimeManager::new(emitter, followups, create_project_store(&forge_home));
        let config = ForgeConfig {
            session: Some(ModelConfig::new("openai", "gpt-4.1")),
            ..Default::default()
        };

        let status = manager
            .open_workspace_with_config(workspace.path().to_path_buf(), config, None)
            .await
            .expect("open workspace");

        assert!(status.configured);
        assert_eq!(
            status.workspace_name,
            workspace
                .path()
                .file_name()
                .map(|value| value.to_string_lossy().into_owned())
        );
    }

    #[tokio::test]
    async fn reset_chat_persists_a_new_empty_conversation() {
        let forge_home = TempDir::new().expect("forge home");
        let workspace = TempDir::new().expect("workspace");
        let _guard = EnvGuard::set_config_dir(forge_home.path());
        let emitter = Arc::new(MemoryEventEmitter::default());
        let followups = Arc::new(FollowupBridge::new(emitter.clone()));
        let manager = RuntimeManager::new(emitter, followups, create_project_store(&forge_home));

        manager
            .open_workspace_with_config(
                workspace.path().to_path_buf(),
                ForgeConfig::default(),
                None,
            )
            .await
            .expect("open workspace");

        let result = manager.reset_chat().await.expect("reset chat");
        let loaded = manager
            .load_conversation(result.conversation_id)
            .await
            .expect("load conversation");

        assert!(loaded.messages.is_empty());
    }

    #[tokio::test]
    async fn list_projects_returns_opened_projects_from_store() {
        let forge_home = TempDir::new().expect("forge home");
        let workspace_one = TempDir::new().expect("workspace one");
        let workspace_two = TempDir::new().expect("workspace two");
        let _guard = EnvGuard::set_config_dir(forge_home.path());
        let emitter = Arc::new(MemoryEventEmitter::default());
        let followups = Arc::new(FollowupBridge::new(emitter.clone()));
        let manager = RuntimeManager::new(emitter, followups, create_project_store(&forge_home));

        manager
            .open_workspace_with_config(
                workspace_one.path().to_path_buf(),
                ForgeConfig::default(),
                None,
            )
            .await
            .expect("open workspace one");
        std::thread::sleep(std::time::Duration::from_secs(1));
        manager
            .open_workspace_with_config(
                workspace_two.path().to_path_buf(),
                ForgeConfig::default(),
                None,
            )
            .await
            .expect("open workspace two");

        let projects = manager.list_projects().await.expect("list projects");

        assert_eq!(projects.len(), 2);
        let paths = projects
            .iter()
            .map(|project| project.workspace_path.clone())
            .collect::<Vec<_>>();
        assert!(
            paths.contains(
                &workspace_one
                    .path()
                    .canonicalize()
                    .unwrap()
                    .to_string_lossy()
                    .into_owned()
            )
        );
        assert!(
            paths.contains(
                &workspace_two
                    .path()
                    .canonicalize()
                    .unwrap()
                    .to_string_lossy()
                    .into_owned()
            )
        );
    }
}
