use std::collections::HashSet;
use std::path::Path;

use forge_domain::Conversation;

use crate::dto::{ConversationSessionSummaryDto, SessionSnapshotDto, WorkspaceSessionDto};

use super::{
    ConversationSessionState, PersistedConversationSummary, RuntimeState, WorkspaceSessionState,
    configuration_error_message, derive_conversation_title_from_messages, read_config,
    session_messages_from_conversation, workspace_name,
};

pub(crate) fn build_snapshot(state: &RuntimeState) -> SessionSnapshotDto {
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
        active_workspace_path,
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

pub(crate) fn hydrate_conversation_state(
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

pub(crate) fn fallback_workspace_state(
    workspace_path: &Path,
    error: String,
) -> WorkspaceSessionState {
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
