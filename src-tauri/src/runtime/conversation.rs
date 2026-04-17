use anyhow::Context;
use forge_api::API;
use forge_domain::ConversationId;

use super::{
    ConversationSessionState, PersistedConversationSummary, RuntimeManager,
    hydrate_conversation_state,
};

impl RuntimeManager {
    pub(super) async fn ensure_conversation_loaded(
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

    pub(super) async fn ensure_conversation_loaded_or_insert_empty(
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
}

pub(crate) fn select_empty_draft_conversation_id(
    state: &super::RuntimeState,
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
