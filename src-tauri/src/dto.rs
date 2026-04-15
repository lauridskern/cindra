use std::path::Path;

use forge_domain::{
    Category, ChatResponse, ChatResponseContent, ContextMessage, Conversation, ConversationId,
    InterruptionReason, Role, ToolResult,
};
use serde::{Deserialize, Serialize};

const TOOL_SUMMARY_LIMIT: usize = 220;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStatusDto {
    pub workspace_path: Option<String>,
    pub workspace_name: Option<String>,
    pub configured: bool,
    pub configuration_error: Option<String>,
}

impl RuntimeStatusDto {
    pub fn new(
        workspace_path: Option<&Path>,
        configured: bool,
        configuration_error: Option<String>,
    ) -> Self {
        Self {
            workspace_path: workspace_path.map(|path| path.to_string_lossy().into_owned()),
            workspace_name: workspace_path
                .and_then(|path| path.file_name())
                .map(|name| name.to_string_lossy().into_owned()),
            configured,
            configuration_error,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SendPromptInput {
    pub prompt: String,
    pub conversation_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SendPromptResultDto {
    pub request_id: String,
    pub conversation_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ResetChatResultDto {
    pub conversation_id: String,
}

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
pub struct WorkspaceConversationGroupDto {
    pub workspace_path: String,
    pub workspace_name: String,
    pub conversations: Vec<ConversationListItemDto>,
}

impl WorkspaceConversationGroupDto {
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
pub struct HistoricalConversationDto {
    pub conversation_id: String,
    pub messages: Vec<HistoricalMessageDto>,
}

impl HistoricalConversationDto {
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
                                messages.push(HistoricalMessageDto::User {
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
                                messages.push(HistoricalMessageDto::Reasoning {
                                    id: format!("history-reasoning:{index}"),
                                    request_id: request_id.clone(),
                                    text: reasoning,
                                });
                            }

                            let content = text.content.trim();
                            if !content.is_empty() {
                                messages.push(HistoricalMessageDto::Assistant {
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
                            messages.push(HistoricalMessageDto::Error {
                                id: format!("history-error:{index}"),
                                request_id: request_id.clone(),
                                message: output.to_string(),
                            });
                        } else {
                            messages.push(HistoricalMessageDto::StatusOutput {
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
pub enum HistoricalMessageDto {
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FollowupKind {
    Text,
    Single,
    Multi,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FollowupOptionDto {
    pub id: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FollowupRequestDto {
    pub followup_id: String,
    pub kind: FollowupKind,
    pub question: String,
    pub options: Option<Vec<FollowupOptionDto>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FollowupResponseDto {
    pub followup_id: String,
    pub cancelled: bool,
    pub text: Option<String>,
    pub selected_option_ids: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum StatusCategoryDto {
    Action,
    Info,
    Debug,
    Error,
    Completion,
    Warning,
}

impl From<Category> for StatusCategoryDto {
    fn from(value: Category) -> Self {
        match value {
            Category::Action => Self::Action,
            Category::Info => Self::Info,
            Category::Debug => Self::Debug,
            Category::Error => Self::Error,
            Category::Completion => Self::Completion,
            Category::Warning => Self::Warning,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ChatEventKind {
    Started,
    AssistantMarkdown {
        text: String,
    },
    Reasoning {
        text: String,
    },
    Status {
        title: String,
        subtitle: Option<String>,
        category: StatusCategoryDto,
    },
    StatusOutput {
        text: String,
    },
    ToolStart {
        name: String,
    },
    ToolEnd {
        name: String,
        summary: Option<String>,
        #[serde(rename = "isError")]
        is_error: bool,
    },
    Retry {
        cause: String,
        #[serde(rename = "durationMs")]
        duration_ms: u64,
    },
    Interrupt {
        reason: String,
    },
    Complete,
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChatEventDto {
    pub request_id: String,
    pub conversation_id: String,
    pub event: ChatEventKind,
}

impl ChatEventDto {
    pub fn new(
        request_id: impl Into<String>,
        conversation_id: ConversationId,
        event: ChatEventKind,
    ) -> Self {
        Self {
            request_id: request_id.into(),
            conversation_id: conversation_id.into_string(),
            event,
        }
    }
}

pub fn map_chat_response(response: &ChatResponse) -> Option<ChatEventKind> {
    match response {
        ChatResponse::TaskMessage { content } => match content {
            ChatResponseContent::ToolInput(title) => Some(ChatEventKind::Status {
                title: title.title.clone(),
                subtitle: title.sub_title.clone(),
                category: title.category.clone().into(),
            }),
            ChatResponseContent::ToolOutput(text) => {
                Some(ChatEventKind::StatusOutput { text: text.clone() })
            }
            ChatResponseContent::Markdown { text, .. } => {
                Some(ChatEventKind::AssistantMarkdown { text: text.clone() })
            }
        },
        ChatResponse::TaskReasoning { content } => Some(ChatEventKind::Reasoning {
            text: content.clone(),
        }),
        ChatResponse::TaskComplete => Some(ChatEventKind::Complete),
        ChatResponse::ToolCallStart { tool_call, .. } => Some(ChatEventKind::ToolStart {
            name: tool_call.name.to_string(),
        }),
        ChatResponse::ToolCallEnd(result) => Some(ChatEventKind::ToolEnd {
            name: result.name.to_string(),
            summary: summarize_tool_result(result),
            is_error: result.is_error(),
        }),
        ChatResponse::RetryAttempt { cause, duration } => Some(ChatEventKind::Retry {
            cause: cause.as_str().to_string(),
            duration_ms: duration.as_millis().min(u64::MAX as u128) as u64,
        }),
        ChatResponse::Interrupt { reason } => Some(ChatEventKind::Interrupt {
            reason: format_interruption(reason),
        }),
    }
}

fn summarize_tool_result(result: &ToolResult) -> Option<String> {
    let text = result.output.as_str()?.trim();
    if text.is_empty() {
        return None;
    }

    let summary = if text.chars().count() <= TOOL_SUMMARY_LIMIT {
        text.to_string()
    } else {
        let truncated = text.chars().take(TOOL_SUMMARY_LIMIT).collect::<String>();
        format!("{truncated}…")
    };

    Some(summary)
}

fn format_interruption(reason: &InterruptionReason) -> String {
    match reason {
        InterruptionReason::MaxToolFailurePerTurnLimitReached { limit, errors } => {
            if errors.is_empty() {
                format!("Stopped after reaching the tool failure limit ({limit}).")
            } else {
                let mut parts = errors
                    .iter()
                    .map(|(tool, count)| format!("{tool}: {count}"))
                    .collect::<Vec<_>>();
                parts.sort();
                format!(
                    "Stopped after reaching the tool failure limit ({limit}). {}",
                    parts.join(", ")
                )
            }
        }
        InterruptionReason::MaxRequestPerTurnLimitReached { limit } => {
            format!("Stopped after reaching the request limit ({limit}).")
        }
    }
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

#[cfg(test)]
mod tests {
    use std::collections::HashMap;
    use std::sync::Arc;
    use std::time::Duration;

    use forge_domain::{
        ChatResponseContent, InterruptionReason, ToolCallFull, ToolName, ToolOutput, ToolResult,
    };
    use tokio::sync::Notify;

    use super::*;

    #[test]
    fn maps_markdown_chunks_to_assistant_events() {
        let response = ChatResponse::TaskMessage {
            content: ChatResponseContent::Markdown {
                text: "hello".to_string(),
                partial: true,
            },
        };

        let event = map_chat_response(&response);

        assert_eq!(
            event,
            Some(ChatEventKind::AssistantMarkdown {
                text: "hello".to_string(),
            })
        );
    }

    #[test]
    fn truncates_tool_result_summary() {
        let long_text = "x".repeat(400);
        let event = map_chat_response(&ChatResponse::ToolCallEnd(
            ToolResult::new(ToolName::new("shell")).output(Ok(ToolOutput::text(long_text))),
        ));

        let ChatEventKind::ToolEnd { summary, .. } = event.expect("tool end event") else {
            panic!("expected tool_end");
        };

        assert_eq!(
            summary.expect("summary").chars().count(),
            TOOL_SUMMARY_LIMIT + 1
        );
    }

    #[test]
    fn formats_interruptions_for_the_ui() {
        let event = map_chat_response(&ChatResponse::Interrupt {
            reason: InterruptionReason::MaxToolFailurePerTurnLimitReached {
                limit: 2,
                errors: HashMap::from([(ToolName::new("shell"), 2)]),
            },
        });

        assert_eq!(
            event,
            Some(ChatEventKind::Interrupt {
                reason: "Stopped after reaching the tool failure limit (2). shell: 2".to_string(),
            })
        );
    }

    #[test]
    fn maps_retry_attempts() {
        let error = anyhow::anyhow!("temporary failure");
        let event = map_chat_response(&ChatResponse::RetryAttempt {
            cause: forge_domain::Cause::from(&error),
            duration: Duration::from_millis(1250),
        });

        assert_eq!(
            event,
            Some(ChatEventKind::Retry {
                cause: "temporary failure".to_string(),
                duration_ms: 1250,
            })
        );
    }

    #[test]
    fn maps_tool_start_events() {
        let tool_call = ToolCallFull::new(ToolName::new("read"));

        let event = map_chat_response(&ChatResponse::ToolCallStart {
            tool_call,
            notifier: Arc::new(Notify::new()),
        });

        assert_eq!(
            event,
            Some(ChatEventKind::ToolStart {
                name: "read".to_string(),
            })
        );
    }
}
