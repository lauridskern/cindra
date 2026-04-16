use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use anyhow::Context;
use forge_api::API;
use forge_domain::{ChatRequest, ChatResponse, Conversation, ConversationId, Event};
use futures::StreamExt;
use tokio::sync::{Mutex, mpsc};
use uuid::Uuid;

use crate::bridge::emitter::UiEventEmitter;
use crate::bridge::followup::{FollowupBridge, FollowupContext, with_followup_context};
use crate::dto::{
    ChatEventKind, ConversationSessionSummaryDto, FollowupRequestDto, FollowupResponseDto,
    PersistedConversationSummary, SendPromptInput, SessionMessageDto, SessionSnapshotDto,
    StatusCategoryDto, WorkspaceSessionDto, derive_conversation_title_from_messages,
    session_messages_from_conversation, workspace_name,
};
use crate::persistence::project_store::ProjectStore;

use super::{
    ConversationSessionState, ForgeRuntime, MISSING_SESSION_MESSAGE, RuntimeFactory, RuntimeState,
    WorkspaceSessionState, configuration_error_message, create_conversation_record, read_config,
    shared_runtime_state,
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

    pub async fn get_session_snapshot(&self) -> anyhow::Result<SessionSnapshotDto> {
        self.snapshot().await
    }

    pub async fn open_workspace(&self, path: PathBuf) -> anyhow::Result<SessionSnapshotDto> {
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

    pub async fn select_conversation(
        &self,
        workspace_path: String,
        conversation_id: String,
    ) -> anyhow::Result<SessionSnapshotDto> {
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

    pub async fn start_new_chat(
        &self,
        workspace_path: String,
    ) -> anyhow::Result<SessionSnapshotDto> {
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
            let created = create_conversation_record(runtime.api.as_ref(), &mut current).await?;
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
            workspace.selected_conversation_id = Some(conversation_id.clone());
        }

        let snapshot = self.snapshot().await?;
        self.emit_snapshot(snapshot.clone())?;
        Ok(snapshot)
    }

    pub async fn send_prompt(&self, input: SendPromptInput) -> anyhow::Result<SessionSnapshotDto> {
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

        let requested_conversation_id = input.conversation_id.clone();
        let mut conversation_id = if let Some(conversation_id) = requested_conversation_id {
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
            let created = create_conversation_record(runtime.api.as_ref(), &mut current).await?;
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

    pub async fn respond_followup(
        &self,
        response: FollowupResponseDto,
    ) -> anyhow::Result<SessionSnapshotDto> {
        self.followups.respond(response.clone()).await?;

        {
            let mut state = self.state.lock().await;
            let conversation_id = state.pending_followups_by_conversation.iter().find_map(
                |(conversation_id, request)| {
                    (request.followup_id == response.followup_id).then_some(conversation_id.clone())
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

    pub async fn cancel_pending_followups(&self) {
        self.followups.cancel_all().await;
        let mut state = self.state.lock().await;
        state.pending_followups_by_conversation.clear();
    }

    async fn ensure_known_workspaces_loaded(&self) -> anyhow::Result<()> {
        let project_paths = self.projects.list_projects()?;
        let project_keys = project_paths
            .iter()
            .map(|path| path.to_string_lossy().into_owned())
            .collect::<Vec<_>>();

        let missing = {
            let mut state = self.state.lock().await;
            state.workspace_order = project_keys.clone();
            project_paths
                .into_iter()
                .filter(|path| {
                    !state
                        .workspaces
                        .contains_key(path.to_string_lossy().as_ref())
                })
                .collect::<Vec<_>>()
        };

        for path in missing {
            let workspace_path = path.to_string_lossy().into_owned();
            let workspace_state = self
                .load_workspace_state(path.clone(), None)
                .await
                .unwrap_or_else(|error| fallback_workspace_state(&path, error.to_string()));

            let mut state = self.state.lock().await;
            state
                .workspaces
                .entry(workspace_path)
                .or_insert(workspace_state);
        }

        Ok(())
    }

    async fn ensure_workspace_runtime(&self, workspace_path: &str) -> anyhow::Result<ForgeRuntime> {
        if let Some(runtime) = self
            .state
            .lock()
            .await
            .workspaces
            .get(workspace_path)
            .and_then(|workspace| workspace.runtime.clone())
        {
            return Ok(runtime);
        }

        let workspace_path_buf = PathBuf::from(workspace_path);
        let (config, configuration_error) = read_config();
        let runtime = self
            .factory
            .build_runtime(
                workspace_path_buf.clone(),
                config.clone(),
                configuration_error.clone(),
            )
            .await?;

        let configured = runtime.config.session.is_some();
        let configuration_error =
            configuration_error_message(configured, runtime.configuration_error.clone());

        let mut state = self.state.lock().await;
        let workspace = state
            .workspaces
            .entry(workspace_path.to_string())
            .or_insert_with(|| WorkspaceSessionState {
                workspace_name: workspace_name(Path::new(workspace_path)),
                ..WorkspaceSessionState::default()
            });
        workspace.workspace_name = workspace_name(Path::new(workspace_path));
        workspace.configured = configured;
        workspace.configuration_error = configuration_error;
        workspace.runtime = Some(runtime.clone());

        if !state
            .workspace_order
            .iter()
            .any(|item| item == workspace_path)
        {
            state.workspace_order.insert(0, workspace_path.to_string());
        }

        Ok(runtime)
    }

    async fn refresh_workspace_conversations(&self, workspace_path: &str) -> anyhow::Result<()> {
        let runtime = self.ensure_workspace_runtime(workspace_path).await?;
        let conversations = runtime.api.get_conversations(None).await?;
        let persisted_conversations = conversations
            .iter()
            .map(PersistedConversationSummary::from_conversation)
            .collect::<Vec<_>>();
        let configured = runtime.config.session.is_some();
        let configuration_error =
            configuration_error_message(configured, runtime.configuration_error.clone());

        let mut state = self.state.lock().await;
        let workspace = state
            .workspaces
            .entry(workspace_path.to_string())
            .or_insert_with(|| WorkspaceSessionState {
                workspace_name: workspace_name(Path::new(workspace_path)),
                ..WorkspaceSessionState::default()
            });
        workspace.workspace_name = workspace_name(Path::new(workspace_path));
        workspace.configured = configured;
        workspace.configuration_error = configuration_error;
        workspace.persisted_conversations = persisted_conversations.clone();

        for persisted in persisted_conversations {
            if let Some(conversation) = state.conversations.get_mut(&persisted.conversation_id) {
                if conversation.title.is_none() {
                    conversation.title = Some(persisted.title.clone());
                }
                if conversation.updated_at.is_none() {
                    conversation.updated_at = persisted.updated_at.clone();
                }
                conversation.workspace_path = workspace_path.to_string();
            }
        }

        Ok(())
    }

    async fn ensure_conversation_loaded(
        &self,
        workspace_path: &str,
        conversation_id: &str,
    ) -> anyhow::Result<()> {
        if self
            .state
            .lock()
            .await
            .conversations
            .contains_key(conversation_id)
        {
            return Ok(());
        }

        let runtime = self.ensure_workspace_runtime(workspace_path).await?;
        let parsed = ConversationId::parse(conversation_id)?;
        let conversation = runtime
            .api
            .conversation(&parsed)
            .await?
            .with_context(|| format!("Conversation not found: {conversation_id}"))?;
        let persisted = PersistedConversationSummary::from_conversation(&conversation);

        let mut state = self.state.lock().await;
        let order = state.allocate_order();
        state.conversations.insert(
            conversation_id.to_string(),
            hydrate_conversation_state(workspace_path, conversation, persisted, order),
        );
        Ok(())
    }

    async fn ensure_conversation_loaded_or_insert_empty(
        &self,
        workspace_path: &str,
        conversation_id: &str,
    ) -> anyhow::Result<()> {
        let exists = self
            .state
            .lock()
            .await
            .conversations
            .contains_key(conversation_id);
        if exists {
            return Ok(());
        }

        match self
            .ensure_conversation_loaded(workspace_path, conversation_id)
            .await
        {
            Ok(()) => Ok(()),
            Err(_) => {
                let mut state = self.state.lock().await;
                let order = state.allocate_order();
                state
                    .conversations
                    .entry(conversation_id.to_string())
                    .or_insert_with(|| ConversationSessionState {
                        workspace_path: workspace_path.to_string(),
                        messages: Vec::new(),
                        title: Some("New chat".to_string()),
                        updated_at: None,
                        active_request_ids: Vec::new(),
                        is_local_draft: true,
                        order,
                    });
                Ok(())
            }
        }
    }

    async fn snapshot(&self) -> anyhow::Result<SessionSnapshotDto> {
        self.ensure_known_workspaces_loaded().await?;
        let state = self.state.lock().await;
        Ok(build_snapshot(&state))
    }

    async fn emit_session_snapshot(&self) -> anyhow::Result<()> {
        let snapshot = self.snapshot().await?;
        self.emit_snapshot(snapshot)
    }

    fn emit_snapshot(&self, snapshot: SessionSnapshotDto) -> anyhow::Result<()> {
        self.emitter.emit_session_updated(snapshot)
    }

    async fn stream_chat(
        &self,
        runtime: ForgeRuntime,
        workspace_path: String,
        request_id: String,
        conversation_id: String,
        prompt: String,
    ) {
        let parsed_conversation_id = match ConversationId::parse(&conversation_id) {
            Ok(value) => value,
            Err(error) => {
                self.record_stream_error(&conversation_id, &request_id, error.to_string())
                    .await;
                let _ = self.emit_session_snapshot().await;
                return;
            }
        };

        let context = FollowupContext {
            workspace_path: workspace_path.clone(),
            conversation_id: conversation_id.clone(),
            request_id: request_id.clone(),
        };

        let stream = with_followup_context(context, async {
            runtime
                .api
                .chat(ChatRequest::new(Event::new(prompt), parsed_conversation_id))
                .await
        })
        .await;

        let stream = match stream {
            Ok(stream) => stream,
            Err(error) => {
                self.record_stream_error(&conversation_id, &request_id, error.to_string())
                    .await;
                let _ = self
                    .finish_request(&workspace_path, &conversation_id, &request_id)
                    .await;
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
                        self.apply_chat_event(&conversation_id, &request_id, event)
                            .await;
                        let _ = self.emit_session_snapshot().await;
                    }

                    if let ChatResponse::ToolCallStart { notifier, .. } = &response {
                        notifier.notify_one();
                    }
                }
                Err(error) => {
                    self.record_stream_error(&conversation_id, &request_id, error.to_string())
                        .await;
                    let _ = self.emit_session_snapshot().await;
                    let _ = self
                        .finish_request(&workspace_path, &conversation_id, &request_id)
                        .await;
                    return;
                }
            }
        }

        if !saw_complete {
            self.finish_request(&workspace_path, &conversation_id, &request_id)
                .await
                .ok();
            return;
        }

        let _ = self
            .finish_request(&workspace_path, &conversation_id, &request_id)
            .await;
    }

    async fn apply_chat_event(
        &self,
        conversation_id: &str,
        request_id: &str,
        event: ChatEventKind,
    ) {
        let mut state = self.state.lock().await;
        let mut should_clear_followup = false;
        let mut next_ui_error: Option<String> = None;

        {
            let conversation = match state.conversations.get_mut(conversation_id) {
                Some(conversation) => conversation,
                None => return,
            };

            match event {
                ChatEventKind::Started => {}
                ChatEventKind::AssistantMarkdown { text } => {
                    append_streamed_message(
                        &mut conversation.messages,
                        StreamedMessageKind::Assistant,
                        request_id,
                        text,
                    );
                }
                ChatEventKind::Reasoning { text } => {
                    append_streamed_message(
                        &mut conversation.messages,
                        StreamedMessageKind::Reasoning,
                        request_id,
                        text,
                    );
                }
                ChatEventKind::Status {
                    title,
                    subtitle,
                    category,
                } => {
                    let next_index = conversation.messages.len();
                    conversation.messages.push(SessionMessageDto::Status {
                        id: create_message_id("status", request_id, next_index),
                        request_id: request_id.to_string(),
                        title,
                        subtitle,
                        category,
                    });
                }
                ChatEventKind::StatusOutput { text } => {
                    let next_index = conversation.messages.len();
                    conversation.messages.push(SessionMessageDto::StatusOutput {
                        id: create_message_id("status-output", request_id, next_index),
                        request_id: request_id.to_string(),
                        text,
                    });
                }
                ChatEventKind::ToolStart { name } => {
                    let next_index = conversation.messages.len();
                    conversation.messages.push(SessionMessageDto::ToolStart {
                        id: create_message_id("tool-start", request_id, next_index),
                        request_id: request_id.to_string(),
                        name,
                    });
                }
                ChatEventKind::ToolEnd {
                    name,
                    summary,
                    is_error,
                } => {
                    let next_index = conversation.messages.len();
                    conversation.messages.push(SessionMessageDto::ToolEnd {
                        id: create_message_id("tool-end", request_id, next_index),
                        request_id: request_id.to_string(),
                        name,
                        summary,
                        is_error,
                    });
                }
                ChatEventKind::Retry { cause, duration_ms } => {
                    let next_index = conversation.messages.len();
                    conversation.messages.push(SessionMessageDto::Status {
                        id: create_message_id("status", request_id, next_index),
                        request_id: request_id.to_string(),
                        title: "Retrying request".to_string(),
                        subtitle: Some(format!("{cause} ({duration_ms} ms)")),
                        category: StatusCategoryDto::Warning,
                    });
                }
                ChatEventKind::Interrupt { reason } => {
                    let next_index = conversation.messages.len();
                    conversation.messages.push(SessionMessageDto::Status {
                        id: create_message_id("status", request_id, next_index),
                        request_id: request_id.to_string(),
                        title: "Interrupted".to_string(),
                        subtitle: Some(reason),
                        category: StatusCategoryDto::Warning,
                    });
                }
                ChatEventKind::Complete => {
                    conversation
                        .active_request_ids
                        .retain(|current| current != request_id);
                }
                ChatEventKind::Error { message } => {
                    should_clear_followup = true;
                    next_ui_error = Some(message.clone());
                    conversation
                        .active_request_ids
                        .retain(|current| current != request_id);
                    let next_index = conversation.messages.len();
                    conversation.messages.push(SessionMessageDto::Error {
                        id: create_message_id("error", request_id, next_index),
                        request_id: request_id.to_string(),
                        message,
                    });
                }
            }

            conversation.title = Some(derive_conversation_title_from_messages(
                &conversation.messages,
            ));
        }

        if let Some(message) = next_ui_error {
            state.ui_error = Some(message);
        }
        if should_clear_followup {
            state
                .pending_followups_by_conversation
                .remove(conversation_id);
        }
    }

    async fn record_stream_error(&self, conversation_id: &str, request_id: &str, message: String) {
        let mut state = self.state.lock().await;
        if let Some(conversation) = state.conversations.get_mut(conversation_id) {
            conversation
                .active_request_ids
                .retain(|current| current != request_id);
            let next_index = conversation.messages.len();
            conversation.messages.push(SessionMessageDto::Error {
                id: create_message_id("error", request_id, next_index),
                request_id: request_id.to_string(),
                message: message.clone(),
            });
            conversation.title = Some(derive_conversation_title_from_messages(
                &conversation.messages,
            ));
        }
        state
            .pending_followups_by_conversation
            .remove(conversation_id);
        state.ui_error = Some(message);
    }

    async fn finish_request(
        &self,
        workspace_path: &str,
        conversation_id: &str,
        request_id: &str,
    ) -> anyhow::Result<()> {
        {
            let mut state = self.state.lock().await;
            if let Some(conversation) = state.conversations.get_mut(conversation_id) {
                conversation
                    .active_request_ids
                    .retain(|current| current != request_id);
            }
        }

        let _ = self.refresh_workspace_conversations(workspace_path).await;
        let snapshot = self.snapshot().await?;
        self.emit_snapshot(snapshot)?;
        Ok(())
    }

    async fn load_workspace_state(
        &self,
        workspace_path: PathBuf,
        resident_runtime: Option<ForgeRuntime>,
    ) -> anyhow::Result<WorkspaceSessionState> {
        let runtime = if let Some(runtime) = resident_runtime.clone() {
            runtime
        } else {
            let (config, configuration_error) = read_config();
            self.factory
                .build_runtime(workspace_path.clone(), config, configuration_error)
                .await?
        };

        let configured = runtime.config.session.is_some();
        let configuration_error =
            configuration_error_message(configured, runtime.configuration_error.clone());
        let conversations = runtime.api.get_conversations(None).await?;

        Ok(WorkspaceSessionState {
            runtime: resident_runtime,
            workspace_name: workspace_name(&workspace_path),
            configured,
            configuration_error,
            selected_conversation_id: None,
            persisted_conversations: conversations
                .iter()
                .map(PersistedConversationSummary::from_conversation)
                .collect(),
        })
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum StreamedMessageKind {
    Assistant,
    Reasoning,
}

fn build_snapshot(state: &RuntimeState) -> SessionSnapshotDto {
    let active_workspace_path = state.active_workspace_path.clone();
    let active_conversation_id = active_workspace_path.as_ref().and_then(|workspace_path| {
        state
            .workspaces
            .get(workspace_path)
            .and_then(|workspace| workspace.selected_conversation_id.clone())
    });

    let visible_messages = active_conversation_id
        .as_ref()
        .and_then(|conversation_id| state.conversations.get(conversation_id))
        .map(|conversation| conversation.messages.clone())
        .unwrap_or_default();

    let visible_followup = active_conversation_id.as_ref().and_then(|conversation_id| {
        state
            .pending_followups_by_conversation
            .get(conversation_id)
            .cloned()
    });

    SessionSnapshotDto {
        active_workspace_label: active_workspace_path
            .as_ref()
            .and_then(|workspace_path| state.workspaces.get(workspace_path))
            .map(|workspace| workspace.workspace_name.clone())
            .unwrap_or_else(|| "Projects".to_string()),
        active_workspace_path: active_workspace_path.clone(),
        active_conversation_id,
        visible_messages,
        visible_followup,
        ui_error: state.ui_error.clone(),
        workspaces: ordered_workspace_paths(state)
            .into_iter()
            .filter_map(|workspace_path| {
                state
                    .workspaces
                    .get(&workspace_path)
                    .map(|workspace| build_workspace_snapshot(state, &workspace_path, workspace))
            })
            .collect(),
    }
}

fn build_workspace_snapshot(
    state: &RuntimeState,
    workspace_path: &str,
    workspace: &WorkspaceSessionState,
) -> WorkspaceSessionDto {
    let selected_conversation_id = workspace.selected_conversation_id.clone();
    let persisted_ids = workspace
        .persisted_conversations
        .iter()
        .map(|conversation| conversation.conversation_id.clone())
        .collect::<HashSet<_>>();

    let mut conversations = workspace
        .persisted_conversations
        .iter()
        .map(|persisted| {
            let local = state.conversations.get(&persisted.conversation_id);
            ConversationSessionSummaryDto {
                conversation_id: persisted.conversation_id.clone(),
                title: local
                    .and_then(|conversation| conversation.title.clone())
                    .unwrap_or_else(|| persisted.title.clone()),
                updated_at: local
                    .and_then(|conversation| conversation.updated_at.clone())
                    .or_else(|| persisted.updated_at.clone()),
                is_selected: selected_conversation_id.as_deref()
                    == Some(persisted.conversation_id.as_str()),
                is_draft: local
                    .map(|conversation| conversation.is_local_draft)
                    .unwrap_or(false),
                is_running: local
                    .map(|conversation| !conversation.active_request_ids.is_empty())
                    .unwrap_or(false),
                has_pending_followup: state
                    .pending_followups_by_conversation
                    .contains_key(&persisted.conversation_id),
            }
        })
        .collect::<Vec<_>>();

    let mut local_only = state
        .conversations
        .iter()
        .filter(|(conversation_id, conversation)| {
            conversation.workspace_path == workspace_path
                && !persisted_ids.contains(*conversation_id)
        })
        .map(
            |(conversation_id, conversation)| ConversationSessionSummaryDto {
                conversation_id: conversation_id.clone(),
                title: conversation.title.clone().unwrap_or_else(|| {
                    derive_conversation_title_from_messages(&conversation.messages)
                }),
                updated_at: conversation.updated_at.clone(),
                is_selected: selected_conversation_id.as_deref() == Some(conversation_id.as_str()),
                is_draft: conversation.is_local_draft,
                is_running: !conversation.active_request_ids.is_empty(),
                has_pending_followup: state
                    .pending_followups_by_conversation
                    .contains_key(conversation_id),
            },
        )
        .collect::<Vec<_>>();

    local_only.sort_by(|left, right| {
        let left_order = state
            .conversations
            .get(&left.conversation_id)
            .map(|conversation| conversation.order)
            .unwrap_or_default();
        let right_order = state
            .conversations
            .get(&right.conversation_id)
            .map(|conversation| conversation.order)
            .unwrap_or_default();
        right_order.cmp(&left_order)
    });
    conversations.splice(0..0, local_only);

    WorkspaceSessionDto {
        workspace_path: workspace_path.to_string(),
        workspace_name: workspace.workspace_name.clone(),
        is_active: state.active_workspace_path.as_deref() == Some(workspace_path),
        configured: workspace.configured,
        configuration_error: workspace.configuration_error.clone(),
        selected_conversation_id,
        conversations,
    }
}

fn ordered_workspace_paths(state: &RuntimeState) -> Vec<String> {
    let mut ordered = state.workspace_order.clone();
    for workspace_path in state.workspaces.keys() {
        if !ordered.iter().any(|current| current == workspace_path) {
            ordered.push(workspace_path.clone());
        }
    }
    ordered
}

fn hydrate_conversation_state(
    workspace_path: &str,
    conversation: Conversation,
    persisted: PersistedConversationSummary,
    order: u64,
) -> ConversationSessionState {
    ConversationSessionState {
        workspace_path: workspace_path.to_string(),
        messages: session_messages_from_conversation(&conversation),
        title: Some(persisted.title),
        updated_at: persisted.updated_at,
        active_request_ids: Vec::new(),
        is_local_draft: false,
        order,
    }
}

fn fallback_workspace_state(workspace_path: &Path, error: String) -> WorkspaceSessionState {
    let (config, configuration_error) = read_config();
    let configured = config.session.is_some();
    let configuration_error = configuration_error_message(configured, Some(error))
        .or(configuration_error_message(configured, configuration_error));

    WorkspaceSessionState {
        runtime: None,
        workspace_name: workspace_name(workspace_path),
        configured,
        configuration_error,
        selected_conversation_id: None,
        persisted_conversations: Vec::new(),
    }
}

fn append_streamed_message(
    messages: &mut Vec<SessionMessageDto>,
    kind: StreamedMessageKind,
    request_id: &str,
    text: String,
) {
    match messages.last_mut() {
        Some(SessionMessageDto::Assistant {
            request_id: current_request_id,
            text: current_text,
            ..
        }) if kind == StreamedMessageKind::Assistant && current_request_id == request_id => {
            current_text.push_str(&text);
        }
        Some(SessionMessageDto::Reasoning {
            request_id: current_request_id,
            text: current_text,
            ..
        }) if kind == StreamedMessageKind::Reasoning && current_request_id == request_id => {
            current_text.push_str(&text);
        }
        _ => {
            let next_index = messages.len();
            match kind {
                StreamedMessageKind::Assistant => messages.push(SessionMessageDto::Assistant {
                    id: create_message_id("assistant", request_id, next_index),
                    request_id: request_id.to_string(),
                    text,
                }),
                StreamedMessageKind::Reasoning => messages.push(SessionMessageDto::Reasoning {
                    id: create_message_id("reasoning", request_id, next_index),
                    request_id: request_id.to_string(),
                    text,
                }),
            }
        }
    }
}

fn create_message_id(prefix: &str, request_id: &str, index: usize) -> String {
    format!("{prefix}:{request_id}:{index}")
}

fn select_empty_draft_conversation_id(
    state: &RuntimeState,
    workspace_path: &str,
) -> Option<String> {
    state
        .conversations
        .iter()
        .filter(|(_, conversation)| {
            conversation.workspace_path == workspace_path
                && conversation.is_local_draft
                && conversation.messages.is_empty()
                && conversation.active_request_ids.is_empty()
        })
        .max_by_key(|(_, conversation)| conversation.order)
        .map(|(conversation_id, _)| conversation_id.clone())
}

fn canonicalize_workspace_path(path: PathBuf) -> anyhow::Result<String> {
    Ok(path
        .canonicalize()
        .with_context(|| format!("Failed to open workspace {}", path.display()))?
        .to_string_lossy()
        .into_owned())
}
