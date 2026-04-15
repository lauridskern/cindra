use forge_domain::{
    Category, ChatResponse, ChatResponseContent, ConversationId, InterruptionReason, ToolResult,
};
use serde::{Deserialize, Serialize};

const TOOL_SUMMARY_LIMIT: usize = 220;

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
