use std::collections::HashMap;
use std::fs;
use std::future::Future;
use std::path::{Path, PathBuf};
use std::str::FromStr;
use std::sync::Arc;

use anyhow::Context;
use forge_api::API;
use forge_domain::{ConfigOperation, ConversationId, Effort, Model, ModelConfig, ProviderId};
use tokio::sync::{Mutex, mpsc, oneshot};
use uuid::Uuid;

use crate::bridge::emitter::UiEventEmitter;
use crate::bridge::followup::FollowupBridge;
use crate::dto::{
    ChatBindingDto, CreateSavedWorkspaceInput, FollowupRequestDto, FollowupResponseDto,
    PromptModelOptionDto, PromptSettingsDto, RuntimeStatusDto, SaveConversationLayoutInput,
    SendPromptInput, SessionMessageDto, SessionSnapshotDto, UpdatePromptSettingsInput,
    UpdateSavedWorkspaceLayoutInput,
};
use crate::persistence::project_store::ProjectStore;

use super::{
    ConversationSessionState, ForgeRuntime, MISSING_SESSION_MESSAGE, RuntimeFactory, RuntimeState,
    WorkspaceKind, WorkspaceSessionState, build_snapshot, canonicalize_workspace_path,
    configuration_error_message, create_conversation_record, create_message_id,
    derive_conversation_title_from_messages, format_error_chain, read_config,
    resolved_workspace_display_name, select_empty_draft_conversation_id, shared_runtime_state,
    user_prompt_text_for_display, workspace_name,
};

#[derive(Clone)]
pub struct RuntimeManager {
    pub(super) emitter: Arc<dyn UiEventEmitter>,
    pub(super) followups: Arc<FollowupBridge>,
    pub(super) projects: Arc<ProjectStore>,
    pub(super) state: Arc<Mutex<RuntimeState>>,
    pub(super) factory: Arc<RuntimeFactory>,
    pub(super) stop_request_senders: Arc<Mutex<HashMap<String, oneshot::Sender<()>>>>,
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
            stop_request_senders: Arc::new(Mutex::new(HashMap::new())),
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

    pub async fn get_runtime_status(
        &self,
        workspace_path: Option<String>,
    ) -> anyhow::Result<RuntimeStatusDto> {
        self.ensure_known_workspaces_loaded().await?;

        if let Some(workspace_path) = workspace_path {
            let workspace_path = canonicalize_workspace_path(PathBuf::from(workspace_path))?;
            self.prepare_workspace(&workspace_path).await?;

            let state = self.state.lock().await;
            let workspace = state
                .workspaces
                .get(&workspace_path)
                .context("Workspace is not loaded.")?;
            return Ok(RuntimeStatusDto::new(
                Some(Path::new(&workspace_path)),
                workspace.configured,
                workspace.configuration_error.clone(),
            ));
        }

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
        self.with_recorded_ui_error(async { self.snapshot().await })
            .await
    }

    pub async fn get_prompt_settings(
        &self,
        workspace_path: Option<String>,
    ) -> anyhow::Result<PromptSettingsDto> {
        self.with_recorded_ui_error(async {
            self.ensure_known_workspaces_loaded().await?;
            let requested_workspace_path = if let Some(workspace_path) = workspace_path {
                Some(canonicalize_workspace_path(PathBuf::from(workspace_path))?)
            } else {
                self.state.lock().await.active_workspace_path.clone()
            };
            let Some(workspace_path) = requested_workspace_path else {
                return Ok(PromptSettingsDto {
                    available_models: Vec::new(),
                    selected_provider_id: None,
                    selected_model_id: None,
                    selected_reasoning_effort: None,
                });
            };

            let runtime = self.prepare_workspace(&workspace_path).await?;
            build_prompt_settings(&runtime).await
        })
        .await
    }

    pub async fn update_prompt_settings(
        &self,
        input: UpdatePromptSettingsInput,
    ) -> anyhow::Result<PromptSettingsDto> {
        self.with_recorded_ui_error(async {
            self.ensure_known_workspaces_loaded().await?;
            let workspace_path = if let Some(workspace_path) = input.workspace_path.clone() {
                canonicalize_workspace_path(PathBuf::from(workspace_path))?
            } else {
                self.state
                    .lock()
                    .await
                    .active_workspace_path
                    .clone()
                    .context("No active workspace.")?
            };
            let runtime = self.prepare_workspace(&workspace_path).await?;

            let provider_id = ProviderId::from(input.provider_id.clone());
            let all_provider_models = runtime.api.get_all_provider_models().await?;
            let selected_model = all_provider_models
                .iter()
                .find(|provider_models| provider_models.provider_id == provider_id)
                .and_then(|provider_models| {
                    provider_models
                        .models
                        .iter()
                        .find(|model| model.id.as_str() == input.model_id)
                })
                .cloned()
                .with_context(|| {
                    format!(
                        "Model '{}' is not available for provider '{}'.",
                        input.model_id, input.provider_id
                    )
                })?;

            let allowed_efforts = reasoning_efforts_for_model(&provider_id, &selected_model);
            let mut operations = vec![ConfigOperation::SetSessionConfig(ModelConfig::new(
                provider_id.clone(),
                input.model_id.clone(),
            ))];

            if let Some(reasoning_effort) = input.reasoning_effort.as_deref() {
                if !allowed_efforts
                    .iter()
                    .any(|candidate| candidate == reasoning_effort)
                {
                    anyhow::bail!(
                        "Reasoning effort '{}' is not available for model '{}'.",
                        reasoning_effort,
                        input.model_id
                    );
                }

                let effort = Effort::from_str(reasoning_effort).map_err(|_| {
                    anyhow::anyhow!("Invalid reasoning effort '{reasoning_effort}'.")
                })?;
                operations.push(ConfigOperation::SetReasoningEffort(effort));
            }

            runtime.api.update_config(operations).await?;
            self.refresh_cached_runtime_config(&workspace_path).await;
            build_prompt_settings(&runtime).await
        })
        .await
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

    pub async fn ensure_conversation_view(
        &self,
        workspace_path: String,
        conversation_id: String,
    ) -> anyhow::Result<SessionSnapshotDto> {
        self.with_recorded_ui_error(async {
            let workspace_path = canonicalize_workspace_path(PathBuf::from(workspace_path))?;
            self.prepare_workspace(&workspace_path).await?;
            self.ensure_conversation_loaded_or_insert_empty(&workspace_path, &conversation_id)
                .await?;
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
            self.prepare_workspace(&workspace_path).await?;
            let (workspace_kind, registered_display_name) =
                self.resolve_workspace_registration(&workspace_path)?;
            let workspace_name = resolved_workspace_display_name(
                workspace_kind,
                Path::new(&workspace_path),
                registered_display_name.as_deref(),
            );

            let mut state = self.state.lock().await;
            state.active_workspace_path = Some(workspace_path.clone());
            state.ui_error = None;
            let workspace = state
                .workspaces
                .entry(workspace_path.clone())
                .or_insert_with(|| WorkspaceSessionState {
                    kind: workspace_kind,
                    workspace_name: workspace_name.clone(),
                    ..WorkspaceSessionState::default()
                });
            workspace.kind = workspace_kind;
            workspace.workspace_name = workspace_name;
            workspace.selected_conversation_id = None;
            drop(state);

            self.emit_current_snapshot().await
        })
        .await
    }

    pub async fn create_managed_chat(&self) -> anyhow::Result<SessionSnapshotDto> {
        self.with_recorded_ui_error(async {
            let workspace_path = self.projects.create_managed_chat_workspace()?;
            self.start_new_chat(workspace_path.to_string_lossy().into_owned())
                .await
        })
        .await
    }

    pub async fn rename_workspace(
        &self,
        workspace_path: String,
        display_name: Option<String>,
    ) -> anyhow::Result<SessionSnapshotDto> {
        self.with_recorded_ui_error(async {
            let workspace_path = canonicalize_workspace_path(PathBuf::from(workspace_path))?;
            self.projects
                .set_workspace_display_name(Path::new(&workspace_path), display_name.as_deref())?;
            let (workspace_kind, registered_display_name) =
                self.resolve_workspace_registration(&workspace_path)?;
            let workspace_name = resolved_workspace_display_name(
                workspace_kind,
                Path::new(&workspace_path),
                registered_display_name.as_deref(),
            );

            {
                let mut state = self.state.lock().await;
                if let Some(workspace) = state.workspaces.get_mut(&workspace_path) {
                    workspace.kind = workspace_kind;
                    workspace.workspace_name = workspace_name;
                }
                state.ui_error = None;
            }

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
            let (registered_kind, registered_display_name) =
                self.resolve_workspace_registration(&workspace_path)?;

            {
                let mut state = self.state.lock().await;
                let workspace_kind = state
                    .workspaces
                    .get(&workspace_path)
                    .map(|workspace| workspace.kind)
                    .unwrap_or(registered_kind);
                let workspace_name = resolved_workspace_display_name(
                    workspace_kind,
                    Path::new(&workspace_path),
                    registered_display_name.as_deref(),
                );
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
                        todos: Vec::new(),
                        pending_file_updates: Default::default(),
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
                        kind: workspace_kind,
                        workspace_name: workspace_name.clone(),
                        ..WorkspaceSessionState::default()
                    });
                workspace.kind = workspace_kind;
                workspace.workspace_name = workspace_name;
                workspace.selected_conversation_id = Some(conversation_id.clone());
                state.active_workspace_path = Some(workspace_path.clone());
                state
                    .pending_followups_by_conversation
                    .remove(&conversation_id);
                state.ui_error = None;
            }

            let snapshot = self.emit_current_snapshot().await?;
            let (stop_sender, stop_receiver) = oneshot::channel();
            self.stop_request_senders
                .lock()
                .await
                .insert(request_id.clone(), stop_sender);

            let manager = self.clone();
            tauri::async_runtime::spawn(async move {
                manager
                    .stream_chat(
                        runtime,
                        workspace_path,
                        request_id,
                        conversation_id,
                        prompt,
                        input.agent_id,
                        stop_receiver,
                    )
                    .await;
            });

            Ok(snapshot)
        })
        .await
    }

    pub async fn stop_prompt(&self, input: ChatBindingDto) -> anyhow::Result<()> {
        let workspace_path = canonicalize_workspace_path(PathBuf::from(input.workspace_path))?;

        let active_request_ids = {
            let state = self.state.lock().await;
            let Some(conversation) = state.conversations.get(&input.conversation_id) else {
                return Ok(());
            };
            if conversation.workspace_path != workspace_path {
                return Ok(());
            }
            conversation.active_request_ids.clone()
        };

        for request_id in active_request_ids {
            if let Some(sender) = self.take_stop_request_sender(&request_id).await {
                let _ = sender.send(());
            }
        }

        Ok(())
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

    pub async fn archive_conversation(
        &self,
        workspace_path: String,
        conversation_id: String,
    ) -> anyhow::Result<SessionSnapshotDto> {
        self.with_recorded_ui_error(async {
            let workspace_path = canonicalize_workspace_path(PathBuf::from(workspace_path))?;
            self.prepare_workspace(&workspace_path).await?;

            let should_delete_persisted = {
                let state = self.state.lock().await;
                let is_running = state
                    .conversations
                    .get(&conversation_id)
                    .map(|conversation| !conversation.active_request_ids.is_empty())
                    .unwrap_or(false);
                if is_running {
                    anyhow::bail!("Cannot archive a running chat.");
                }

                state
                    .workspaces
                    .get(&workspace_path)
                    .map(|workspace| {
                        workspace
                            .persisted_conversations
                            .iter()
                            .any(|conversation| conversation.conversation_id == conversation_id)
                    })
                    .unwrap_or(false)
            };

            if should_delete_persisted {
                let runtime = self.ensure_workspace_runtime(&workspace_path).await?;
                let conversation_id = ConversationId::parse(&conversation_id)?;
                runtime.api.delete_conversation(&conversation_id).await?;
                self.refresh_workspace_conversations(&workspace_path)
                    .await?;
            }

            self.projects.delete_conversation_layout(&conversation_id)?;

            {
                let mut state = self.state.lock().await;
                state.conversations.remove(&conversation_id);
                state
                    .pending_followups_by_conversation
                    .remove(&conversation_id);

                if let Some(workspace) = state.workspaces.get_mut(&workspace_path) {
                    workspace
                        .persisted_conversations
                        .retain(|conversation| conversation.conversation_id != conversation_id);
                    if workspace.selected_conversation_id.as_deref()
                        == Some(conversation_id.as_str())
                    {
                        workspace.selected_conversation_id = None;
                    }
                }
                state.ui_error = None;
            }

            self.emit_current_snapshot().await
        })
        .await
    }

    pub async fn archive_workspace(
        &self,
        workspace_path: String,
    ) -> anyhow::Result<SessionSnapshotDto> {
        self.with_recorded_ui_error(async {
            let workspace_path = canonicalize_workspace_path(PathBuf::from(workspace_path))?;
            let workspace_kind = self
                .projects
                .get_workspace_kind(Path::new(&workspace_path))?
                .unwrap_or(crate::persistence::project_store::RegisteredWorkspaceKind::Project);

            let conversation_ids = {
                let state = self.state.lock().await;
                let conversation_ids = state
                    .workspaces
                    .get(&workspace_path)
                    .into_iter()
                    .flat_map(|workspace| {
                        workspace
                            .persisted_conversations
                            .iter()
                            .map(|conversation| conversation.conversation_id.clone())
                    })
                    .chain(
                        state
                            .conversations
                            .iter()
                            .filter(|(_, conversation)| {
                                conversation.workspace_path == workspace_path.as_str()
                            })
                            .map(|(conversation_id, _)| conversation_id.clone()),
                    )
                    .collect::<Vec<_>>();

                let has_running_conversation = conversation_ids.iter().any(|conversation_id| {
                    state
                        .conversations
                        .get(conversation_id)
                        .map(|conversation| !conversation.active_request_ids.is_empty())
                        .unwrap_or(false)
                });
                if has_running_conversation {
                    anyhow::bail!("Cannot archive a workspace with a running chat.");
                }

                conversation_ids
            };

            self.projects
                .archive_workspace(Path::new(&workspace_path))?;
            for conversation_id in &conversation_ids {
                self.projects.delete_conversation_layout(conversation_id)?;
            }

            if matches!(
                workspace_kind,
                crate::persistence::project_store::RegisteredWorkspaceKind::ManagedChat
            ) {
                match fs::remove_dir_all(&workspace_path) {
                    Ok(()) => {}
                    Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                    Err(error) => return Err(error.into()),
                }
            }

            {
                let mut state = self.state.lock().await;
                for conversation_id in &conversation_ids {
                    state.conversations.remove(conversation_id);
                    state
                        .pending_followups_by_conversation
                        .remove(conversation_id);
                }

                state.workspaces.remove(&workspace_path);
                state.workspace_order.retain(|path| path != &workspace_path);
                if state.active_workspace_path.as_deref() == Some(workspace_path.as_str()) {
                    state.active_workspace_path = state
                        .workspace_order
                        .iter()
                        .find(|path| state.workspaces.contains_key(*path))
                        .cloned();
                }
                state.ui_error = None;
            }

            self.emit_current_snapshot().await
        })
        .await
    }

    pub async fn save_conversation_layout(
        &self,
        input: SaveConversationLayoutInput,
    ) -> anyhow::Result<()> {
        self.projects
            .save_conversation_layout(&input.conversation_id, &input.layout_json)
    }

    pub async fn get_conversation_layout(
        &self,
        conversation_id: String,
    ) -> anyhow::Result<Option<String>> {
        self.projects.get_conversation_layout(&conversation_id)
    }

    pub async fn create_saved_workspace(
        &self,
        input: CreateSavedWorkspaceInput,
    ) -> anyhow::Result<crate::dto::SavedWorkspaceDetailDto> {
        let workspace_name = self.generate_saved_workspace_name(&input.chats).await?;
        let workspace_id = Uuid::new_v4().to_string();
        let record = self.projects.create_saved_workspace(
            &workspace_id,
            &workspace_name,
            &input.layout_json,
        )?;
        let snapshot = self.snapshot().await?;
        self.emit_snapshot(snapshot)?;

        Ok(crate::dto::SavedWorkspaceDetailDto {
            id: record.id,
            name: record.name,
            layout_json: record.layout_json,
            updated_at: record.updated_at,
        })
    }

    pub async fn update_saved_workspace_layout(
        &self,
        input: UpdateSavedWorkspaceLayoutInput,
    ) -> anyhow::Result<crate::dto::SavedWorkspaceDetailDto> {
        let record = self
            .projects
            .update_saved_workspace_layout(&input.workspace_id, &input.layout_json)?;
        let snapshot = self.snapshot().await?;
        self.emit_snapshot(snapshot)?;

        Ok(crate::dto::SavedWorkspaceDetailDto {
            id: record.id,
            name: record.name,
            layout_json: record.layout_json,
            updated_at: record.updated_at,
        })
    }

    pub async fn get_saved_workspace(
        &self,
        workspace_id: String,
    ) -> anyhow::Result<Option<crate::dto::SavedWorkspaceDetailDto>> {
        Ok(self
            .projects
            .get_saved_workspace(&workspace_id)?
            .map(|record| crate::dto::SavedWorkspaceDetailDto {
                id: record.id,
                name: record.name,
                layout_json: record.layout_json,
                updated_at: record.updated_at,
            }))
    }

    pub async fn rename_saved_workspace(
        &self,
        workspace_id: String,
        name: String,
    ) -> anyhow::Result<SessionSnapshotDto> {
        self.with_recorded_ui_error(async {
            self.projects.rename_saved_workspace(&workspace_id, &name)?;
            {
                let mut state = self.state.lock().await;
                state.ui_error = None;
            }
            self.emit_current_snapshot().await
        })
        .await
    }

    pub async fn delete_saved_workspace(
        &self,
        workspace_id: String,
    ) -> anyhow::Result<SessionSnapshotDto> {
        self.with_recorded_ui_error(async {
            self.projects.delete_saved_workspace(&workspace_id)?;
            {
                let mut state = self.state.lock().await;
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
        let saved_workspaces = self.projects.list_saved_workspaces()?;
        Ok(build_snapshot(&state, &saved_workspaces))
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
            let _ = self.record_ui_error(&format_error_chain(error)).await;
        }

        result
    }

    pub(super) async fn record_ui_error(&self, message: &str) -> anyhow::Result<()> {
        {
            let mut state = self.state.lock().await;
            state.ui_error = Some(message.to_string());
        }
        let snapshot = self.snapshot().await?;
        self.emit_snapshot(snapshot)
    }

    pub(super) async fn clear_ui_error(&self) -> anyhow::Result<()> {
        {
            let mut state = self.state.lock().await;
            if state.ui_error.is_none() {
                return Ok(());
            }
            state.ui_error = None;
        }
        let snapshot = self.snapshot().await?;
        self.emit_snapshot(snapshot)
    }

    pub(super) async fn take_stop_request_sender(
        &self,
        request_id: &str,
    ) -> Option<oneshot::Sender<()>> {
        self.stop_request_senders.lock().await.remove(request_id)
    }

    pub(super) async fn prepare_workspace(
        &self,
        workspace_path: &str,
    ) -> anyhow::Result<ForgeRuntime> {
        match self
            .projects
            .get_workspace_kind(Path::new(workspace_path))?
        {
            Some(crate::persistence::project_store::RegisteredWorkspaceKind::ManagedChat) => {
                self.projects
                    .touch_managed_chat_workspace(Path::new(workspace_path))?;
            }
            _ => {
                self.projects.add_project(Path::new(workspace_path))?;
            }
        }
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
        let (registered_kind, registered_display_name) = self
            .resolve_workspace_registration(workspace_path)
            .unwrap_or((WorkspaceKind::Project, None));
        let mut state = self.state.lock().await;
        let workspace_kind = state
            .workspaces
            .get(workspace_path)
            .map(|workspace| workspace.kind)
            .unwrap_or(registered_kind);
        let workspace_name = resolved_workspace_display_name(
            workspace_kind,
            Path::new(workspace_path),
            registered_display_name.as_deref(),
        );
        state.active_workspace_path = Some(workspace_path.to_string());
        state.ui_error = None;
        let workspace = state
            .workspaces
            .entry(workspace_path.to_string())
            .or_insert_with(|| WorkspaceSessionState {
                kind: workspace_kind,
                workspace_name: workspace_name.clone(),
                ..WorkspaceSessionState::default()
            });
        workspace.kind = workspace_kind;
        workspace.workspace_name = workspace_name;
        workspace.selected_conversation_id = Some(conversation_id.to_string());
    }

    async fn emit_current_snapshot(&self) -> anyhow::Result<SessionSnapshotDto> {
        let snapshot = self.snapshot().await?;
        self.emit_snapshot(snapshot.clone())?;
        Ok(snapshot)
    }

    async fn refresh_cached_runtime_config(&self, workspace_path: &str) {
        let (config, configuration_error) = read_config();
        let configured = config.session.is_some();
        let derived_error = configuration_error_message(configured, configuration_error.clone());

        let mut state = self.state.lock().await;
        if let Some(workspace) = state.workspaces.get_mut(workspace_path) {
            workspace.configured = configured;
            workspace.configuration_error = derived_error.clone();

            if let Some(runtime) = workspace.runtime.as_mut() {
                runtime.config = config;
                runtime.configuration_error = configuration_error;
            }
        }
    }

    async fn generate_saved_workspace_name(
        &self,
        chats: &[crate::dto::ChatBindingDto],
    ) -> anyhow::Result<String> {
        if chats.is_empty() {
            anyhow::bail!("Saved workspaces need at least one chat.");
        }

        let mut ordered_names = Vec::new();
        for chat in chats {
            let workspace_path =
                canonicalize_workspace_path(PathBuf::from(chat.workspace_path.clone()))?;
            let derived_name = workspace_name(Path::new(&workspace_path));
            if !ordered_names.iter().any(|name| name == &derived_name) {
                ordered_names.push(derived_name);
            }
        }

        if ordered_names.len() == 1 {
            return Ok(format!("{} ({} chats)", ordered_names[0], chats.len()));
        }

        Ok(ordered_names.join(" + "))
    }
}

async fn build_prompt_settings(runtime: &ForgeRuntime) -> anyhow::Result<PromptSettingsDto> {
    let current_config = runtime.api.get_session_config().await;
    let current_effort = runtime.api.get_reasoning_effort().await?;
    let mut all_provider_models = runtime.api.get_all_provider_models().await?;

    all_provider_models.iter_mut().for_each(|provider_models| {
        provider_models
            .models
            .sort_by(|left, right| left.id.as_str().cmp(right.id.as_str()))
    });
    all_provider_models
        .sort_by(|left, right| left.provider_id.as_ref().cmp(right.provider_id.as_ref()));

    let available_models = all_provider_models
        .into_iter()
        .flat_map(|provider_models| {
            let provider_name = provider_models.provider_id.to_string();
            let provider_id = provider_models.provider_id.as_ref().to_string();

            provider_models
                .models
                .into_iter()
                .map(move |model| PromptModelOptionDto {
                    provider_id: provider_id.clone(),
                    provider_name: provider_name.clone(),
                    model_id: model.id.to_string(),
                    model_name: model.name.clone(),
                    context_length: model.context_length,
                    supports_reasoning: model.supports_reasoning == Some(true),
                    reasoning_efforts: reasoning_efforts_for_model(
                        &provider_models.provider_id,
                        &model,
                    ),
                })
        })
        .collect::<Vec<_>>();

    let selected_provider_id = current_config
        .as_ref()
        .map(|config| config.provider.as_ref().to_string());
    let selected_model_id = current_config
        .as_ref()
        .map(|config| config.model.to_string());
    let selected_reasoning_effort =
        current_effort
            .map(|effort| effort.to_string())
            .filter(|effort| {
                selected_provider_id
                    .as_ref()
                    .zip(selected_model_id.as_ref())
                    .and_then(|(provider_id, model_id)| {
                        available_models.iter().find(|model| {
                            &model.provider_id == provider_id && &model.model_id == model_id
                        })
                    })
                    .is_some_and(|model| {
                        model
                            .reasoning_efforts
                            .iter()
                            .any(|candidate| candidate == effort)
                    })
            });

    Ok(PromptSettingsDto {
        available_models,
        selected_provider_id,
        selected_model_id,
        selected_reasoning_effort,
    })
}

fn reasoning_efforts_for_model(provider_id: &ProviderId, model: &Model) -> Vec<String> {
    if model.supports_reasoning != Some(true) {
        return Vec::new();
    }

    let provider_key: &str = provider_id.as_ref().as_ref();
    let supported = match provider_key {
        "anthropic" | "anthropic_compatible" | "vertex_ai_anthropic" | "claude_code" => {
            &["low", "medium", "high", "max"][..]
        }
        "openai"
        | "open_router"
        | "requesty"
        | "github_copilot"
        | "openai_compatible"
        | "openai_responses_compatible"
        | "forge"
        | "codex" => &["none", "minimal", "low", "medium", "high", "xhigh"][..],
        "xai" | "zai" | "zai_coding" | "vertex_ai" | "google_ai_studio" => &[][..],
        _ => &["low", "medium", "high"][..],
    };

    supported
        .iter()
        .map(|effort| (*effort).to_string())
        .collect()
}
