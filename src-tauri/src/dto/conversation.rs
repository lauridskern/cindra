use std::path::Path;

use forge_domain::{ContextMessage, Conversation, Role};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConversationListItemDto {
    pub conversation_id: String,
    pub title: String,
    pub updated_at: Option<String>,
}

impl ConversationListItemDto {
    pub fn from_conversation(conversation: &Conversation) -> Self {
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummaryDto {
    pub workspace_path: String,
    pub workspace_name: String,
    pub conversations: Vec<ConversationListItemDto>,
}

impl ProjectSummaryDto {
    pub fn new(workspace_path: &Path, conversations: &[Conversation]) -> Self {
        Self {
            workspace_path: workspace_path.to_string_lossy().into_owned(),
            workspace_name: workspace_name(workspace_path),
            conversations: conversations
                .iter()
                .map(ConversationListItemDto::from_conversation)
                .collect(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConversationTranscriptDto {
    pub conversation_id: String,
    pub messages: Vec<ConversationMessageDto>,
}

impl ConversationTranscriptDto {
    pub fn from_conversation(conversation: &Conversation) -> Self {
        let request_id = format!("history:{}", conversation.id.into_string());
        let mut messages = Vec::new();

        if let Some(context) = &conversation.context {
            for (index, entry) in context.messages.iter().enumerate() {
                match &entry.message {
                    ContextMessage::Text(text) => match text.role {
                        Role::User => {
                            let content = text.content.trim();
                            if !content.is_empty() {
                                messages.push(ConversationMessageDto::User {
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
                                messages.push(ConversationMessageDto::Reasoning {
                                    id: format!("history-reasoning:{index}"),
                                    request_id: request_id.clone(),
                                    text: reasoning,
                                });
                            }

                            let content = text.content.trim();
                            if !content.is_empty() {
                                messages.push(ConversationMessageDto::Assistant {
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
                            messages.push(ConversationMessageDto::Error {
                                id: format!("history-error:{index}"),
                                request_id: request_id.clone(),
                                message: output.to_string(),
                            });
                        } else {
                            messages.push(ConversationMessageDto::StatusOutput {
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

        Self {
            conversation_id: conversation.id.into_string(),
            messages,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ConversationMessageDto {
    User {
        id: String,
        request_id: String,
        text: String,
    },
    Assistant {
        id: String,
        request_id: String,
        text: String,
    },
    Reasoning {
        id: String,
        request_id: String,
        text: String,
    },
    StatusOutput {
        id: String,
        request_id: String,
        text: String,
    },
    Error {
        id: String,
        request_id: String,
        message: String,
    },
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

    if let Some(context) = &conversation.context {
        for entry in &context.messages {
            if let ContextMessage::Text(text) = &entry.message {
                if matches!(text.role, Role::User | Role::Assistant) {
                    let content = text
                        .content
                        .split_whitespace()
                        .collect::<Vec<_>>()
                        .join(" ");
                    if !content.is_empty() {
                        return content;
                    }
                }
            }
        }
    }

    "New chat".to_string()
}

fn workspace_name(path: &Path) -> String {
    path.file_name()
        .map(|value| value.to_string_lossy().into_owned())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| path.to_string_lossy().into_owned())
}
