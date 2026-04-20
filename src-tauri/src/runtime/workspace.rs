use std::path::{Path, PathBuf};

use anyhow::Context;
use forge_api::API;

use super::{
    ForgeRuntime, PersistedConversationSummary, RuntimeManager, WorkspaceSessionState,
    configuration_error_message, fallback_workspace_state, format_error_chain, read_config,
    workspace_name,
};

impl RuntimeManager {
    pub(super) async fn ensure_known_workspaces_loaded(&self) -> anyhow::Result<()> {
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
                .unwrap_or_else(|error| {
                    fallback_workspace_state(&path, format_error_chain(&error))
                });

            let mut state = self.state.lock().await;
            state
                .workspaces
                .entry(workspace_path)
                .or_insert(workspace_state);
        }

        Ok(())
    }

    pub(super) async fn ensure_workspace_runtime(
        &self,
        workspace_path: &str,
    ) -> anyhow::Result<ForgeRuntime> {
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

    pub(super) async fn refresh_workspace_conversations(
        &self,
        workspace_path: &str,
    ) -> anyhow::Result<()> {
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

pub(crate) fn canonicalize_workspace_path(path: PathBuf) -> anyhow::Result<String> {
    Ok(path
        .canonicalize()
        .with_context(|| format!("Failed to open workspace {}", path.display()))?
        .to_string_lossy()
        .into_owned())
}
