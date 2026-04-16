use std::path::Path;

use forge_domain::{ContextMessage, Conversation, Role};

use crate::dto::SessionMessageDto;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct PersistedConversationSummary {
    pub(crate) conversation_id: String,
    pub(crate) title: String,
    pub(crate) updated_at: Option<String>,
}

impl PersistedConversationSummary {
    pub(crate) fn from_conversation(conversation: &Conversation) -> Self {
        Self {
            conversation_id: conversation.id.into_string(),
            title: conversation_title(conversation),
            updated_at: conversation
                .metadata
                .updated_at
                .or(Some(conversation.metadata.created_at))
                .map(|value| value.to_rfc3339()),
        }
    }
}

pub(crate) fn session_messages_from_conversation(
    conversation: &Conversation,
) -> Vec<SessionMessageDto> {
    let request_id = format!("history:{}", conversation.id.into_string());
    let mut messages = Vec::new();

    if let Some(context) = &conversation.context {
        for (index, entry) in context.messages.iter().enumerate() {
            match &entry.message {
                ContextMessage::Text(text) => match text.role {
                    Role::User => {
                        let content = text.content.trim();
                        if !content.is_empty() {
                            messages.push(SessionMessageDto::User {
                                id: format!("history-user:{index}"),
                                request_id: request_id.clone(),
                                text: content.to_string(),
                            });
                        }
                    }
                    Role::Assistant => {
                        let reasoning = text
                            .reasoning_details
                            .as_ref()
                            .map(|details| {
                                details
                                    .iter()
                                    .filter_map(|detail| detail.text.as_deref())
                                    .map(str::trim)
                                    .filter(|text| !text.is_empty())
                                    .collect::<Vec<_>>()
                                    .join("\n")
                            })
                            .filter(|text| !text.is_empty());

                        if let Some(reasoning) = reasoning {
                            messages.push(SessionMessageDto::Reasoning {
                                id: format!("history-reasoning:{index}"),
                                request_id: request_id.clone(),
                                text: reasoning,
                            });
                        }

                        let content = text.content.trim();
                        if !content.is_empty() {
                            messages.push(SessionMessageDto::Assistant {
                                id: format!("history-assistant:{index}"),
                                request_id: request_id.clone(),
                                text: content.to_string(),
                            });
                        }
                    }
                    Role::System => {}
                },
                ContextMessage::Tool(result) => {
                    let output = result.output.as_str().map(str::trim).unwrap_or_default();
                    if output.is_empty() {
                        continue;
                    }

                    if result.is_error() {
                        messages.push(SessionMessageDto::Error {
                            id: format!("history-error:{index}"),
                            request_id: request_id.clone(),
                            message: output.to_string(),
                        });
                    } else {
                        messages.push(SessionMessageDto::StatusOutput {
                            id: format!("history-tool:{index}"),
                            request_id: request_id.clone(),
                            text: output.to_string(),
                        });
                    }
                }
                ContextMessage::Image(_) => {}
            }
        }
    }

    messages
}

pub(crate) fn derive_conversation_title_from_messages(messages: &[SessionMessageDto]) -> String {
    if let Some(text) = messages.iter().find_map(first_user_or_assistant_text) {
        let collapsed = collapse_whitespace(text);
        if !collapsed.is_empty() {
            return collapsed.chars().take(72).collect();
        }
    }

    "New chat".to_string()
}

pub(crate) fn workspace_name(path: &Path) -> String {
    path.file_name()
        .map(|value| value.to_string_lossy().into_owned())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| path.to_string_lossy().into_owned())
}

fn conversation_title(conversation: &Conversation) -> String {
    if let Some(title) = conversation
        .title
        .as_deref()
        .map(str::trim)
        .filter(|title| !title.is_empty())
    {
        return title.to_string();
    }

    derive_conversation_title_from_messages(&session_messages_from_conversation(conversation))
}

fn first_user_or_assistant_text(message: &SessionMessageDto) -> Option<&str> {
    match message {
        SessionMessageDto::User { text, .. }
        | SessionMessageDto::Assistant { text, .. }
        | SessionMessageDto::Reasoning { text, .. } => Some(text.as_str()),
        SessionMessageDto::StatusOutput { text, .. } => Some(text.as_str()),
        SessionMessageDto::Status { title, .. } => Some(title.as_str()),
        SessionMessageDto::ToolStart { name, .. } | SessionMessageDto::ToolEnd { name, .. } => {
            Some(name.as_str())
        }
        SessionMessageDto::Error { message, .. } => Some(message.as_str()),
    }
}

fn collapse_whitespace(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}
