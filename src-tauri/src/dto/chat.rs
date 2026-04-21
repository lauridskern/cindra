use forge_domain::{
    Category, ChatResponse, ChatResponseContent, ConversationId, InterruptionReason,
};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::activity::{
    ToolCallDetailDto, ToolResultDetailDto, map_tool_call_detail, map_tool_result_detail,
    normalize_tool_output_text, summarize_tool_result,
};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "snake_case")]
#[ts(rename = "StatusCategory")]
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
        #[serde(rename = "callId")]
        call_id: Option<String>,
        detail: ToolCallDetailDto,
    },
    ToolEnd {
        name: String,
        #[serde(rename = "callId")]
        call_id: Option<String>,
        summary: Option<String>,
        #[serde(rename = "isError")]
        is_error: bool,
        detail: Option<ToolResultDetailDto>,
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
                normalize_tool_output_text(text).map(|text| ChatEventKind::StatusOutput { text })
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
            call_id: tool_call
                .call_id
                .as_ref()
                .map(|call_id| call_id.as_str().to_string()),
            detail: map_tool_call_detail(tool_call),
        }),
        ChatResponse::ToolCallEnd(result) => Some(ChatEventKind::ToolEnd {
            name: result.name.to_string(),
            call_id: result
                .call_id
                .as_ref()
                .map(|call_id| call_id.as_str().to_string()),
            summary: summarize_tool_result(result),
            is_error: result.is_error(),
            detail: map_tool_result_detail(result),
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
