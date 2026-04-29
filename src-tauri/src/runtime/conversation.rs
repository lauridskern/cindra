use std::collections::HashMap;

use anyhow::Context;
use forge_api::API;
use forge_domain::ConversationId;

use crate::dto::{SessionMessageDto, ToolResultDetailDto};

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
        let existing = self
            .state
            .lock()
            .await
            .conversations
            .get(conversation_id)
            .cloned();
        if existing.as_ref().is_some_and(|conversation| {
            !conversation.active_request_ids.is_empty() || conversation.is_local_draft
        }) {
            return Ok(());
        }

        let existing_order = existing.map(|conversation| conversation.order);
        self.reload_conversation_from_persistence(workspace_path, conversation_id, existing_order)
            .await
    }

    pub(super) async fn reload_conversation_from_persistence(
        &self,
        workspace_path: &str,
        conversation_id: &str,
        order_hint: Option<u64>,
    ) -> anyhow::Result<()> {
        let runtime = self.ensure_workspace_runtime(workspace_path).await?;
        let parsed = ConversationId::parse(conversation_id)?;
        let conversation = runtime
            .api
            .conversation(&parsed)
            .await?
            .with_context(|| format!("Conversation not found: {conversation_id}"))?;
        let persisted = PersistedConversationSummary::from_conversation(&conversation);

        let mut state = self.state.lock().await;
        let existing_order = state
            .conversations
            .get(conversation_id)
            .map(|current| current.order);
        let transient_details = state
            .conversations
            .get(conversation_id)
            .map(|current| collect_transient_tool_result_details(&current.messages))
            .unwrap_or_default();
        let order = order_hint
            .or(existing_order)
            .unwrap_or_else(|| state.allocate_order());
        let mut next_state =
            hydrate_conversation_state(workspace_path, conversation, persisted, order);
        apply_transient_tool_result_details(&mut next_state.messages, &transient_details);
        state
            .conversations
            .insert(conversation_id.to_string(), next_state);
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
                        todos: Vec::new(),
                        pending_file_updates: Default::default(),
                        pending_anonymous_file_updates: Default::default(),
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

fn collect_transient_tool_result_details(
    messages: &[SessionMessageDto],
) -> HashMap<ToolResultDetailKey, ToolResultDetailDto> {
    messages
        .iter()
        .filter_map(|message| match message {
            SessionMessageDto::ToolEnd {
                id,
                call_id,
                detail: Some(detail @ ToolResultDetailDto::FileDiff { .. }),
                ..
            } => Some((ToolResultDetailKey::new(id, call_id), detail.clone())),
            _ => None,
        })
        .collect()
}

fn apply_transient_tool_result_details(
    messages: &mut [SessionMessageDto],
    transient_details: &HashMap<ToolResultDetailKey, ToolResultDetailDto>,
) {
    for message in messages {
        let SessionMessageDto::ToolEnd {
            id,
            call_id,
            detail,
            ..
        } = message
        else {
            continue;
        };
        let Some(transient_detail) = transient_details.get(&ToolResultDetailKey::new(id, call_id))
        else {
            continue;
        };

        *detail = Some(transient_detail.clone());
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
enum ToolResultDetailKey {
    CallId(String),
    MessageId(String),
}

impl ToolResultDetailKey {
    fn new(id: &str, call_id: &Option<String>) -> Self {
        if let Some(call_id) = call_id.as_ref().filter(|call_id| !call_id.is_empty()) {
            return Self::CallId(call_id.clone());
        }

        Self::MessageId(normalize_history_tool_end_id(id).to_string())
    }
}

fn normalize_history_tool_end_id(id: &str) -> &str {
    if let Some(index) = id.strip_prefix("history-tool-end:") {
        return index;
    }

    let Some(index) = id.strip_prefix("tool-end:") else {
        return id;
    };

    index.rsplit_once(':').map_or(index, |(_, suffix)| suffix)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn file_diff(path: &str) -> ToolResultDetailDto {
        ToolResultDetailDto::FileDiff {
            path: path.to_string(),
            patch: "diff --git a/file b/file".to_string(),
        }
    }

    fn tool_end(
        id: &str,
        call_id: Option<&str>,
        detail: Option<ToolResultDetailDto>,
    ) -> SessionMessageDto {
        SessionMessageDto::ToolEnd {
            id: id.to_string(),
            request_id: "request".to_string(),
            name: "patch".to_string(),
            call_id: call_id.map(str::to_string),
            summary: None,
            is_error: false,
            detail,
        }
    }

    #[test]
    fn restores_transient_diff_details_by_tool_call_id() {
        let transient = vec![tool_end(
            "tool-end:request:3",
            Some("call_patch"),
            Some(file_diff("src/example.ts")),
        )];
        let details = collect_transient_tool_result_details(&transient);
        let mut reloaded = vec![tool_end("history-tool-end:9", Some("call_patch"), None)];

        apply_transient_tool_result_details(&mut reloaded, &details);

        assert_eq!(
            reloaded,
            vec![tool_end(
                "history-tool-end:9",
                Some("call_patch"),
                Some(file_diff("src/example.ts")),
            )]
        );
    }

    #[test]
    fn restores_transient_diff_details_by_normalized_message_index() {
        let transient = vec![tool_end(
            "tool-end:request:4",
            None,
            Some(file_diff("src/example.ts")),
        )];
        let details = collect_transient_tool_result_details(&transient);
        let mut reloaded = vec![tool_end("history-tool-end:4", None, None)];

        apply_transient_tool_result_details(&mut reloaded, &details);

        assert_eq!(
            reloaded,
            vec![tool_end(
                "history-tool-end:4",
                None,
                Some(file_diff("src/example.ts")),
            )]
        );
    }

    #[test]
    fn ignores_non_diff_tool_details_when_collecting_transient_details() {
        let transient = vec![SessionMessageDto::ToolEnd {
            id: "tool-end:request:4".to_string(),
            request_id: "request".to_string(),
            name: "patch".to_string(),
            call_id: None,
            summary: None,
            is_error: false,
            detail: Some(ToolResultDetailDto::Text {
                text: "ok".to_string(),
            }),
        }];
        let details = collect_transient_tool_result_details(&transient);

        assert!(details.is_empty());
    }
}
