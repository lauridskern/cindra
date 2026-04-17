use std::path::Path;

use forge_domain::{ContextMessage, Conversation, Role};
use roxmltree::{Document, Node};

use crate::dto::{
    SessionMessageDto, map_tool_call_detail, map_tool_result_detail, summarize_tool_result,
};

const DISPLAY_PROMPT_TAGS: &[&str] = &["feedback", "task"];
const HIDDEN_PROMPT_TAGS: &[&str] = &["system_date"];

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
                        let content = user_prompt_text_for_display(&text.content);
                        if !content.is_empty() {
                            messages.push(SessionMessageDto::User {
                                id: format!("history-user:{index}"),
                                request_id: request_id.clone(),
                                text: content,
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

                        if let Some(tool_calls) = &text.tool_calls {
                            messages.extend(tool_calls.iter().map(|tool_call| {
                                SessionMessageDto::ToolStart {
                                    id: format!(
                                        "history-tool-start:{index}:{}",
                                        tool_call
                                            .call_id
                                            .as_ref()
                                            .map(|call_id| call_id.as_str())
                                            .unwrap_or_else(|| tool_call.name.as_str()),
                                    ),
                                    request_id: request_id.clone(),
                                    name: tool_call.name.as_str().to_string(),
                                    call_id: tool_call
                                        .call_id
                                        .as_ref()
                                        .map(|call_id| call_id.as_str().to_string()),
                                    detail: map_tool_call_detail(tool_call),
                                }
                            }));
                        }
                    }
                    Role::System => {}
                },
                ContextMessage::Tool(result) => {
                    messages.push(SessionMessageDto::ToolEnd {
                        id: format!("history-tool-end:{index}"),
                        request_id: request_id.clone(),
                        name: result.name.as_str().to_string(),
                        call_id: result
                            .call_id
                            .as_ref()
                            .map(|call_id| call_id.as_str().to_string()),
                        summary: summarize_tool_result(result),
                        is_error: result.is_error(),
                        detail: map_tool_result_detail(result),
                    });
                }
                ContextMessage::Image(_) => {}
            }
        }
    }

    messages
}

pub(crate) fn derive_conversation_title_from_messages(messages: &[SessionMessageDto]) -> String {
    if let Some(title) = messages.iter().find_map(title_candidate_from_message) {
        return title;
    }

    "New chat".to_string()
}

pub(crate) fn user_prompt_text_for_display(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    match extract_structured_prompt_text(trimmed) {
        Some(text) if !text.is_empty() => text,
        _ => trimmed.to_string(),
    }
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
        return user_prompt_text_for_display(title);
    }

    derive_conversation_title_from_messages(&session_messages_from_conversation(conversation))
}

fn title_candidate_from_message(message: &SessionMessageDto) -> Option<String> {
    match message {
        SessionMessageDto::User { text, .. } => {
            let display = user_prompt_text_for_display(text);
            if display.is_empty() {
                None
            } else {
                Some(display.chars().take(72).collect())
            }
        }
        SessionMessageDto::Assistant { text, .. } => {
            let collapsed = collapse_whitespace(text);
            if collapsed.is_empty() {
                None
            } else {
                Some(collapsed.chars().take(72).collect())
            }
        }
        _ => None,
    }
}

fn collapse_whitespace(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn extract_structured_prompt_text(value: &str) -> Option<String> {
    let wrapped = format!("<prompt_display>{value}</prompt_display>");
    let document = Document::parse(&wrapped).ok()?;
    let root = document.root_element();
    let mut parts = Vec::new();

    for child in root.children() {
        if child.is_text() {
            if !child.text().unwrap_or_default().trim().is_empty() {
                return None;
            }
            continue;
        }

        if child.is_element() == false {
            continue;
        }

        let tag_name = child.tag_name().name();
        if HIDDEN_PROMPT_TAGS.contains(&tag_name) {
            continue;
        }
        if DISPLAY_PROMPT_TAGS.contains(&tag_name) == false {
            return None;
        }

        let text = collapse_whitespace(&collect_node_text(child));
        if !text.is_empty() {
            parts.push(text);
        }
    }

    if parts.is_empty() {
        None
    } else {
        Some(parts.join(" "))
    }
}

fn collect_node_text(node: Node<'_, '_>) -> String {
    node.descendants()
        .filter(|child| child.is_text())
        .filter_map(|child| child.text())
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;
    use forge_domain::{Context, ContextMessage, ConversationId, ToolCatalog, ToolResult};

    #[test]
    fn test_session_messages_from_conversation_preserves_tool_activity_history() {
        let conversation_id = ConversationId::generate();
        let todo_call = ToolCatalog::tool_call_todo_read().call_id("call_todos");
        let read_call = ToolCatalog::tool_call_read("/tmp/package.json").call_id("call_read");
        let fixture = Conversation::new(conversation_id).context(
            Context::default()
                .add_message(ContextMessage::user("<task>inspect</task>", None))
                .add_message(ContextMessage::assistant(
                    "",
                    None,
                    None,
                    Some(vec![todo_call.clone(), read_call.clone()]),
                ))
                .add_tool_results(vec![
                    ToolResult::from(todo_call).success("<todos count=\"0\">\n</todos>"),
                    ToolResult::from(read_call).success("1:{\n2:  \"name\": \"demo\"\n3:}\n"),
                ])
                .add_message(ContextMessage::assistant("Done.", None, None, None)),
        );

        let actual = session_messages_from_conversation(&fixture);

        let request_id = format!("history:{}", conversation_id.into_string());
        let expected = vec![
            SessionMessageDto::User {
                id: "history-user:0".to_string(),
                request_id: request_id.clone(),
                text: "inspect".to_string(),
            },
            SessionMessageDto::ToolStart {
                id: "history-tool-start:1:call_todos".to_string(),
                request_id: request_id.clone(),
                name: "todo_read".to_string(),
                call_id: Some("call_todos".to_string()),
                detail: map_tool_call_detail(
                    &ToolCatalog::tool_call_todo_read().call_id("call_todos"),
                ),
            },
            SessionMessageDto::ToolStart {
                id: "history-tool-start:1:call_read".to_string(),
                request_id: request_id.clone(),
                name: "read".to_string(),
                call_id: Some("call_read".to_string()),
                detail: map_tool_call_detail(
                    &ToolCatalog::tool_call_read("/tmp/package.json").call_id("call_read"),
                ),
            },
            SessionMessageDto::ToolEnd {
                id: "history-tool-end:2".to_string(),
                request_id: request_id.clone(),
                name: "todo_read".to_string(),
                call_id: Some("call_todos".to_string()),
                summary: Some("<todos count=\"0\">\n</todos>".to_string()),
                is_error: false,
                detail: None,
            },
            SessionMessageDto::ToolEnd {
                id: "history-tool-end:3".to_string(),
                request_id: request_id.clone(),
                name: "read".to_string(),
                call_id: Some("call_read".to_string()),
                summary: Some("1:{\n2:  \"name\": \"demo\"\n3:}".to_string()),
                is_error: false,
                detail: map_tool_result_detail(
                    &ToolResult::from(
                        ToolCatalog::tool_call_read("/tmp/package.json").call_id("call_read"),
                    )
                    .success("1:{\n2:  \"name\": \"demo\"\n3:}\n"),
                ),
            },
            SessionMessageDto::Assistant {
                id: "history-assistant:4".to_string(),
                request_id,
                text: "Done.".to_string(),
            },
        ];

        assert_eq!(actual, expected);
    }
}
