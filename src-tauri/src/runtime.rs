use std::path::{Path, PathBuf};
use std::sync::Arc;

use anyhow::Context;
use forge_api::{API, ForgeAPI};
use forge_app::AgentRegistry;
use forge_config::ForgeConfig;
use forge_domain::{AgentId, ChatRequest, ChatResponse, Conversation, ConversationId, Event};
use forge_infra::ForgeInfra;
use forge_repo::ForgeRepo;
use forge_services::ForgeServices;
use futures::StreamExt;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::desktop_infra::DesktopInfra;
use crate::dto::{
    ChatEventDto, ChatEventKind, FollowupResponseDto, HistoricalConversationDto,
    ResetChatResultDto, RuntimeStatusDto, SendPromptInput, SendPromptResultDto,
    WorkspaceConversationGroupDto,
};
use crate::emitter::UiEventEmitter;
use crate::followup::FollowupBridge;
use crate::project_registry::ProjectRegistry;

type DesktopRepo = ForgeRepo<DesktopInfra>;
type DesktopServices = ForgeServices<DesktopRepo>;
type DesktopApi = ForgeAPI<DesktopServices, DesktopRepo>;
const MISSING_SESSION_MESSAGE: &str =
    "No Forge session is configured. Configure Forge in the terminal first.";

#[derive(Clone)]
struct ForgeRuntime {
    api: Arc<DesktopApi>,
    config: ForgeConfig,
    configuration_error: Option<String>,
}

impl ForgeRuntime {
    async fn status(&self, workspace_path: Option<&Path>) -> anyhow::Result<RuntimeStatusDto> {
        let configured = self.config.session.is_some();

        Ok(RuntimeStatusDto::new(
            workspace_path,
            configured,
            configuration_error_message(configured, self.configuration_error.clone()),
        ))
    }
}

#[derive(Clone, Default)]
struct RuntimeState {
    workspace_path: Option<PathBuf>,
    runtime: Option<ForgeRuntime>,
    conversation_id: Option<ConversationId>,
    active_request_id: Option<String>,
}

#[derive(Clone)]
pub struct RuntimeManager {
    emitter: Arc<dyn UiEventEmitter>,
    followups: Arc<FollowupBridge>,
    registry: Arc<ProjectRegistry>,
    state: Arc<Mutex<RuntimeState>>,
}

pub struct DesktopState {
    pub manager: Arc<RuntimeManager>,
}

impl DesktopState {
    pub fn new(emitter: Arc<dyn UiEventEmitter>, registry: Arc<ProjectRegistry>) -> Self {
        let followups = Arc::new(FollowupBridge::new(emitter.clone()));
        let manager = RuntimeManager::new(emitter, followups, registry);
        Self {
            manager: Arc::new(manager),
        }
    }
}

impl RuntimeManager {
    pub fn new(
        emitter: Arc<dyn UiEventEmitter>,
        followups: Arc<FollowupBridge>,
        registry: Arc<ProjectRegistry>,
    ) -> Self {
        Self {
            emitter,
            followups,
            registry,
            state: Arc::new(Mutex::new(RuntimeState::default())),
        }
    }

    pub async fn open_workspace(&self, path: PathBuf) -> anyhow::Result<RuntimeStatusDto> {
        let (config, configuration_error) = read_config();
        self.open_workspace_with_config(path, config, configuration_error)
            .await
    }

    pub async fn open_workspace_with_config(
        &self,
        path: PathBuf,
        config: ForgeConfig,
        configuration_error: Option<String>,
    ) -> anyhow::Result<RuntimeStatusDto> {
        self.followups.cancel_all().await;
        self.registry.add_project(path.as_path())?;

        let runtime = build_runtime(
            path.clone(),
            config,
            configuration_error,
            self.followups.clone(),
        )
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

    pub async fn list_projects(&self) -> anyhow::Result<Vec<WorkspaceConversationGroupDto>> {
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

        let project_paths = self.registry.list_projects()?;
        let project_groups =
            futures::future::join_all(project_paths.into_iter().map(|workspace_path| {
                let config = config.clone();
                let configuration_error = configuration_error.clone();
                let followups = self.followups.clone();
                let current_runtime = runtime.clone();
                let current_path = current_path.clone();
                async move {
                    let project_runtime = if current_path.as_ref() == Some(&workspace_path) {
                        current_runtime
                    } else {
                        build_runtime(
                            workspace_path.clone(),
                            config,
                            configuration_error,
                            followups,
                        )
                        .await
                        .ok()
                    }?;
                    let conversations = project_runtime.api.get_conversations(None).await.ok()?;
                    Some(WorkspaceConversationGroupDto::new(
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
    ) -> anyhow::Result<HistoricalConversationDto> {
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

        Ok(HistoricalConversationDto::from_conversation(&conversation))
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
                    runtime.configuration_error.clone().unwrap_or_else(|| {
                        "No Forge session is configured. Configure Forge in the terminal first."
                            .to_string()
                    })
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

            let conversation = Conversation::generate();
            let conversation_id = conversation.id;
            runtime.api.upsert_conversation_record(conversation).await?;
            state.conversation_id = Some(conversation_id);

            conversation_id
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

fn read_config() -> (ForgeConfig, Option<String>) {
    match ForgeConfig::read() {
        Ok(config) => (config, None),
        Err(error) => (ForgeConfig::default(), Some(error.to_string())),
    }
}

async fn build_runtime(
    workspace_path: PathBuf,
    config: ForgeConfig,
    configuration_error: Option<String>,
    followups: Arc<FollowupBridge>,
) -> anyhow::Result<ForgeRuntime> {
    let infra = Arc::new(DesktopInfra::new(
        ForgeInfra::new(workspace_path, config.clone()),
        followups,
    ));
    let repo = Arc::new(ForgeRepo::new(infra));
    let services = Arc::new(ForgeServices::new(repo.clone()));
    services.set_active_agent_id(AgentId::default()).await?;
    let api = Arc::new(ForgeAPI::new(services.clone(), repo));

    Ok(ForgeRuntime {
        api,
        config,
        configuration_error,
    })
}

fn configuration_error_message(
    configured: bool,
    configuration_error: Option<String>,
) -> Option<String> {
    if configured {
        configuration_error
    } else {
        Some(configuration_error.unwrap_or_else(|| MISSING_SESSION_MESSAGE.to_string()))
    }
}

#[async_trait::async_trait]
trait ConversationUpserter {
    async fn upsert_conversation_record(&self, conversation: Conversation) -> anyhow::Result<()>;
}

#[async_trait::async_trait]
impl ConversationUpserter for DesktopApi {
    async fn upsert_conversation_record(&self, conversation: Conversation) -> anyhow::Result<()> {
        self.upsert_conversation(conversation).await
    }
}

async fn resolve_conversation_id<A: ConversationUpserter + Sync>(
    api: &A,
    current: &mut Option<ConversationId>,
    requested: Option<&str>,
) -> anyhow::Result<ConversationId> {
    if let Some(requested) = requested {
        let parsed = ConversationId::parse(requested)?;
        *current = Some(parsed);
        return Ok(parsed);
    }

    if let Some(existing) = current {
        return Ok(*existing);
    }

    let conversation = Conversation::generate();
    let conversation_id = conversation.id;
    api.upsert_conversation_record(conversation).await?;
    *current = Some(conversation_id);
    Ok(conversation_id)
}

#[cfg(test)]
mod tests {
    use std::path::Path;
    use std::sync::{Mutex as StdMutex, MutexGuard};

    use forge_config::{ForgeConfig, ModelConfig};
    use tempfile::TempDir;
    use tokio::sync::Mutex;

    use super::*;
    use crate::emitter::MemoryEventEmitter;
    use crate::project_registry::ProjectRegistry;

    static ENV_MUTEX: StdMutex<()> = StdMutex::new(());

    struct EnvGuard {
        _lock: MutexGuard<'static, ()>,
    }

    impl EnvGuard {
        fn set_config_dir(path: &Path) -> Self {
            let lock = ENV_MUTEX.lock().expect("env mutex");
            unsafe { std::env::set_var("FORGE_CONFIG", path) };
            Self { _lock: lock }
        }
    }

    impl Drop for EnvGuard {
        fn drop(&mut self) {
            unsafe { std::env::remove_var("FORGE_CONFIG") };
        }
    }

    fn registry(root: &TempDir) -> Arc<ProjectRegistry> {
        Arc::new(ProjectRegistry::new(root.path().join("projects.db")).expect("registry"))
    }

    #[derive(Default)]
    struct FakeConversationApi {
        upserts: Mutex<Vec<ConversationId>>,
    }

    #[async_trait::async_trait]
    impl ConversationUpserter for FakeConversationApi {
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
        let manager = RuntimeManager::new(emitter, followups, registry(&forge_home));
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
        let manager = RuntimeManager::new(emitter, followups, registry(&forge_home));

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
    async fn list_projects_returns_opened_projects_from_registry() {
        let forge_home = TempDir::new().expect("forge home");
        let workspace_one = TempDir::new().expect("workspace one");
        let workspace_two = TempDir::new().expect("workspace two");
        let _guard = EnvGuard::set_config_dir(forge_home.path());
        let emitter = Arc::new(MemoryEventEmitter::default());
        let followups = Arc::new(FollowupBridge::new(emitter.clone()));
        let manager = RuntimeManager::new(emitter, followups, registry(&forge_home));

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
