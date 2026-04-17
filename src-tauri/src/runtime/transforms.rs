use std::path::Path;

use forge_domain::{ContextMessage, Conversation, Role};
use roxmltree::{Document, Node};

use crate::dto::{SessionMessageDto, normalize_tool_output_text};

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
                    }
                    Role::System => {}
                },
                ContextMessage::Tool(result) => {
                    let Some(output) = result
                        .output
                        .as_str()
                        .and_then(normalize_tool_output_text)
                    else {
                        continue;
                    };

                    if result.is_error() {
                        messages.push(SessionMessageDto::Error {
                            id: format!("history-error:{index}"),
                            request_id: request_id.clone(),
                            message: output,
                        });
                    } else {
                        messages.push(SessionMessageDto::StatusOutput {
                            id: format!("history-tool:{index}"),
                            request_id: request_id.clone(),
                            text: output,
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
