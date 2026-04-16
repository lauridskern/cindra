use forge_domain::{Category, ChatResponse, ChatResponseContent, InterruptionReason, ToolResult};
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
