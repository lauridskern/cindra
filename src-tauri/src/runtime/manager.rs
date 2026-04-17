use std::future::Future;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use anyhow::Context;
use tokio::sync::{Mutex, mpsc};
use uuid::Uuid;

use crate::bridge::emitter::UiEventEmitter;
use crate::bridge::followup::FollowupBridge;
use crate::dto::{
    FollowupRequestDto, FollowupResponseDto, RuntimeStatusDto, SendPromptInput, SessionMessageDto,
    SessionSnapshotDto,
};
use crate::persistence::project_store::ProjectStore;

use super::{
    ConversationSessionState, ForgeRuntime, MISSING_SESSION_MESSAGE, RuntimeFactory,
    RuntimeState, WorkspaceSessionState, build_snapshot, canonicalize_workspace_path,
    configuration_error_message, create_conversation_record, create_message_id,
    derive_conversation_title_from_messages, read_config, select_empty_draft_conversation_id,
    shared_runtime_state, user_prompt_text_for_display, workspace_name,
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

    pub async fn get_session_snapshot(&self) -> anyhow::Result<SessionSnapshotDto> {
        self.with_recorded_ui_error(async { self.snapshot().await }).await
    }

    pub async fn open_workspace(&self, path: PathBuf) -> anyhow::Result<SessionSnapshotDto> {
        self.with_recorded_ui_error(async {
            let workspace_path = canonicalize_workspace_path(path)?;
            self.prepare_workspace(&workspace_path).await?;
            let selected_conversation_id = self.activate_workspace(&workspace_path).await;

            if let Some(conversation_id) = selected_conversation_id {
                self.ensure_conversation_loaded(&workspace_path, &conversation_id)
                    .await?;
            }

            self.emit_current_snapshot().await
        })
        .await
    }

    pub async fn select_conversation(
        &self,
        workspace_path: String,
        conversation_id: String,
    ) -> anyhow::Result<SessionSnapshotDto> {
        self.with_recorded_ui_error(async {
            let workspace_path = canonicalize_workspace_path(PathBuf::from(workspace_path))?;
            self.prepare_workspace(&workspace_path).await?;
            self.ensure_conversation_loaded(&workspace_path, &conversation_id)
                .await?;
            self.select_workspace_conversation(&workspace_path, &conversation_id)
                .await;
            self.emit_current_snapshot().await
        })
        .await
    }

    pub async fn start_new_chat(
        &self,
        workspace_path: String,
    ) -> anyhow::Result<SessionSnapshotDto> {
        self.with_recorded_ui_error(async {
            let workspace_path = canonicalize_workspace_path(PathBuf::from(workspace_path))?;
            let runtime = self.prepare_workspace(&workspace_path).await?;

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

            self.select_workspace_conversation(&workspace_path, &conversation_id)
                .await;
            self.emit_current_snapshot().await
        })
        .await
    }

    pub async fn send_prompt(&self, input: SendPromptInput) -> anyhow::Result<SessionSnapshotDto> {
        self.with_recorded_ui_error(async {
            let workspace_path =
                canonicalize_workspace_path(PathBuf::from(input.workspace_path.trim()))?;

            let prompt = input.prompt.trim().to_string();
            if prompt.is_empty() {
                anyhow::bail!("Prompt cannot be empty.");
            }
            let display_prompt = user_prompt_text_for_display(&prompt);

            let runtime = self.prepare_workspace(&workspace_path).await?;

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
                    text: display_prompt,
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

            let snapshot = self.emit_current_snapshot().await?;

            let manager = self.clone();
            tauri::async_runtime::spawn(async move {
                manager
                    .stream_chat(runtime, workspace_path, request_id, conversation_id, prompt)
                    .await;
            });

            Ok(snapshot)
        })
        .await
    }

    pub async fn respond_followup(
        &self,
        response: FollowupResponseDto,
    ) -> anyhow::Result<SessionSnapshotDto> {
        self.with_recorded_ui_error(async {
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

            self.emit_current_snapshot().await
        })
        .await
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

    pub(super) async fn with_recorded_ui_error<T, F>(&self, operation: F) -> anyhow::Result<T>
    where
        F: Future<Output = anyhow::Result<T>>,
    {
        let result = operation.await;

        if let Err(error) = &result {
            let _ = self.record_ui_error(&error.to_string()).await;
        }

        result
    }

    pub(super) async fn record_ui_error(&self, message: &str) -> anyhow::Result<()> {
        let snapshot = {
            let mut state = self.state.lock().await;
            state.ui_error = Some(message.to_string());
            build_snapshot(&state)
        };

        self.emit_snapshot(snapshot)
    }

    pub(super) async fn clear_ui_error(&self) -> anyhow::Result<()> {
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

    async fn prepare_workspace(&self, workspace_path: &str) -> anyhow::Result<ForgeRuntime> {
        self.projects.add_project(Path::new(workspace_path))?;
        let runtime = self.ensure_workspace_runtime(workspace_path).await?;
        self.refresh_workspace_conversations(workspace_path).await?;
        Ok(runtime)
    }

    async fn activate_workspace(&self, workspace_path: &str) -> Option<String> {
        let mut state = self.state.lock().await;
        state.active_workspace_path = Some(workspace_path.to_string());
        state.ui_error = None;
        state
            .workspaces
            .get(workspace_path)
            .and_then(|workspace| workspace.selected_conversation_id.clone())
    }

    async fn select_workspace_conversation(&self, workspace_path: &str, conversation_id: &str) {
        let mut state = self.state.lock().await;
        state.active_workspace_path = Some(workspace_path.to_string());
        state.ui_error = None;
        let workspace = state
            .workspaces
            .entry(workspace_path.to_string())
            .or_insert_with(|| WorkspaceSessionState {
                workspace_name: workspace_name(Path::new(workspace_path)),
                ..WorkspaceSessionState::default()
            });
        workspace.selected_conversation_id = Some(conversation_id.to_string());
    }

    async fn emit_current_snapshot(&self) -> anyhow::Result<SessionSnapshotDto> {
        let snapshot = self.snapshot().await?;
        self.emit_snapshot(snapshot.clone())?;
        Ok(snapshot)
    }
}
