use forge_api::API;
use forge_domain::{ChatRequest, ChatResponse, ConversationId, Event};
use futures::StreamExt;

use crate::bridge::followup::{FollowupContext, with_followup_context};
use crate::dto::{ChatEventKind, SessionMessageDto, StatusCategoryDto};

use super::{ForgeRuntime, RuntimeManager, derive_conversation_title_from_messages};

#[derive(Clone, Copy, PartialEq, Eq)]
enum StreamedMessageKind {
    Assistant,
    Reasoning,
}

impl RuntimeManager {
    pub(super) async fn stream_chat(
        &self,
        runtime: ForgeRuntime,
        workspace_path: String,
        request_id: String,
        conversation_id: String,
        prompt: String,
    ) {
        let parsed_conversation_id = match ConversationId::parse(&conversation_id) {
            Ok(value) => value,
            Err(error) => {
                self.record_stream_error(&conversation_id, &request_id, error.to_string())
                    .await;
                let _ = self.emit_session_snapshot().await;
                return;
            }
        };

        let context = FollowupContext {
            workspace_path: workspace_path.clone(),
            conversation_id: conversation_id.clone(),
            request_id: request_id.clone(),
        };

        let stream = match with_followup_context(context, async {
            runtime
                .api
                .chat(ChatRequest::new(Event::new(prompt), parsed_conversation_id))
                .await
        })
        .await
        {
            Ok(stream) => stream,
            Err(error) => {
                self.record_stream_error(&conversation_id, &request_id, error.to_string())
                    .await;
                let _ = self
                    .finish_request(&workspace_path, &conversation_id, &request_id)
                    .await;
                return;
            }
        };

        tokio::pin!(stream);
        let mut saw_complete = false;

        while let Some(item) = stream.next().await {
            match item {
                Ok(response) => {
                    if let Some(event) = crate::dto::map_chat_response(&response) {
                        if matches!(event, ChatEventKind::Complete) {
                            saw_complete = true;
                        }
                        self.apply_chat_event(&conversation_id, &request_id, event)
                            .await;
                        let _ = self.emit_session_snapshot().await;
                    }

                    if let ChatResponse::ToolCallStart { notifier, .. } = &response {
                        notifier.notify_one();
                    }
                }
                Err(error) => {
                    self.record_stream_error(&conversation_id, &request_id, error.to_string())
                        .await;
                    let _ = self.emit_session_snapshot().await;
                    let _ = self
                        .finish_request(&workspace_path, &conversation_id, &request_id)
                        .await;
                    return;
                }
            }
        }

        if !saw_complete {
            self.finish_request(&workspace_path, &conversation_id, &request_id)
                .await
                .ok();
            return;
        }

        let _ = self
            .finish_request(&workspace_path, &conversation_id, &request_id)
            .await;
    }

    async fn apply_chat_event(
        &self,
        conversation_id: &str,
        request_id: &str,
        event: ChatEventKind,
    ) {
        let mut state = self.state.lock().await;
        let mut should_clear_followup = false;
        let mut next_ui_error: Option<String> = None;

        {
            let conversation = match state.conversations.get_mut(conversation_id) {
                Some(conversation) => conversation,
                None => return,
            };

            match event {
                ChatEventKind::Started => {}
                ChatEventKind::AssistantMarkdown { text } => {
                    append_streamed_message(
                        &mut conversation.messages,
                        StreamedMessageKind::Assistant,
                        request_id,
                        text,
                    );
                }
                ChatEventKind::Reasoning { text } => {
                    append_streamed_message(
                        &mut conversation.messages,
                        StreamedMessageKind::Reasoning,
                        request_id,
                        text,
                    );
                }
                ChatEventKind::Status {
                    title,
                    subtitle,
                    category,
                } => {
                    let next_index = conversation.messages.len();
                    conversation.messages.push(SessionMessageDto::Status {
                        id: create_message_id("status", request_id, next_index),
                        request_id: request_id.to_string(),
                        title,
                        subtitle,
                        category,
                    });
                }
                ChatEventKind::StatusOutput { text } => {
                    let next_index = conversation.messages.len();
                    conversation.messages.push(SessionMessageDto::StatusOutput {
                        id: create_message_id("status-output", request_id, next_index),
                        request_id: request_id.to_string(),
                        text,
                    });
                }
                ChatEventKind::ToolStart {
                    name,
                    call_id,
                    detail,
                } => {
                    let next_index = conversation.messages.len();
                    conversation.messages.push(SessionMessageDto::ToolStart {
                        id: create_message_id("tool-start", request_id, next_index),
                        request_id: request_id.to_string(),
                        name,
                        call_id,
                        detail,
                    });
                }
                ChatEventKind::ToolEnd {
                    name,
                    call_id,
                    summary,
                    is_error,
                    detail,
                } => {
                    let next_index = conversation.messages.len();
                    conversation.messages.push(SessionMessageDto::ToolEnd {
                        id: create_message_id("tool-end", request_id, next_index),
                        request_id: request_id.to_string(),
                        name,
                        call_id,
                        summary,
                        is_error,
                        detail,
                    });
                }
                ChatEventKind::Retry { cause, duration_ms } => {
                    let next_index = conversation.messages.len();
                    conversation.messages.push(SessionMessageDto::Status {
                        id: create_message_id("status", request_id, next_index),
                        request_id: request_id.to_string(),
                        title: "Retrying request".to_string(),
                        subtitle: Some(format!("{cause} ({duration_ms} ms)")),
                        category: StatusCategoryDto::Warning,
                    });
                }
                ChatEventKind::Interrupt { reason } => {
                    let next_index = conversation.messages.len();
                    conversation.messages.push(SessionMessageDto::Status {
                        id: create_message_id("status", request_id, next_index),
                        request_id: request_id.to_string(),
                        title: "Interrupted".to_string(),
                        subtitle: Some(reason),
                        category: StatusCategoryDto::Warning,
                    });
                }
                ChatEventKind::Complete => {
                    conversation
                        .active_request_ids
                        .retain(|current| current != request_id);
                }
                ChatEventKind::Error { message } => {
                    should_clear_followup = true;
                    next_ui_error = Some(message.clone());
                    conversation
                        .active_request_ids
                        .retain(|current| current != request_id);
                    let next_index = conversation.messages.len();
                    conversation.messages.push(SessionMessageDto::Error {
                        id: create_message_id("error", request_id, next_index),
                        request_id: request_id.to_string(),
                        message,
                    });
                }
            }

            conversation.title = Some(derive_conversation_title_from_messages(
                &conversation.messages,
            ));
        }

        if let Some(message) = next_ui_error {
            state.ui_error = Some(message);
        }
        if should_clear_followup {
            state
                .pending_followups_by_conversation
                .remove(conversation_id);
        }
    }

    async fn record_stream_error(&self, conversation_id: &str, request_id: &str, message: String) {
        let mut state = self.state.lock().await;
        if let Some(conversation) = state.conversations.get_mut(conversation_id) {
            conversation
                .active_request_ids
                .retain(|current| current != request_id);
            let next_index = conversation.messages.len();
            conversation.messages.push(SessionMessageDto::Error {
                id: create_message_id("error", request_id, next_index),
                request_id: request_id.to_string(),
                message: message.clone(),
            });
            conversation.title = Some(derive_conversation_title_from_messages(
                &conversation.messages,
            ));
        }
        state
            .pending_followups_by_conversation
            .remove(conversation_id);
        state.ui_error = Some(message);
    }

    async fn finish_request(
        &self,
        workspace_path: &str,
        conversation_id: &str,
        request_id: &str,
    ) -> anyhow::Result<()> {
        {
            let mut state = self.state.lock().await;
            if let Some(conversation) = state.conversations.get_mut(conversation_id) {
                conversation
                    .active_request_ids
                    .retain(|current| current != request_id);
            }
        }

        let _ = self.refresh_workspace_conversations(workspace_path).await;
        let order_hint = self
            .state
            .lock()
            .await
            .conversations
            .get(conversation_id)
            .map(|conversation| conversation.order);
        let _ = self
            .reload_conversation_from_persistence(workspace_path, conversation_id, order_hint)
            .await;
        let snapshot = self.snapshot().await?;
        self.emit_snapshot(snapshot)?;
        Ok(())
    }
}

pub(crate) fn create_message_id(prefix: &str, request_id: &str, index: usize) -> String {
    format!("{prefix}:{request_id}:{index}")
}

fn append_streamed_message(
    messages: &mut Vec<SessionMessageDto>,
    kind: StreamedMessageKind,
    request_id: &str,
    text: String,
) {
    match messages.last_mut() {
        Some(SessionMessageDto::Assistant {
            request_id: current_request_id,
            text: current_text,
            ..
        }) if kind == StreamedMessageKind::Assistant && current_request_id == request_id => {
            current_text.push_str(&text);
        }
        Some(SessionMessageDto::Reasoning {
            request_id: current_request_id,
            text: current_text,
            ..
        }) if kind == StreamedMessageKind::Reasoning && current_request_id == request_id => {
            current_text.push_str(&text);
        }
        _ => {
            let next_index = messages.len();
            match kind {
                StreamedMessageKind::Assistant => messages.push(SessionMessageDto::Assistant {
                    id: create_message_id("assistant", request_id, next_index),
                    request_id: request_id.to_string(),
                    text,
                }),
                StreamedMessageKind::Reasoning => messages.push(SessionMessageDto::Reasoning {
                    id: create_message_id("reasoning", request_id, next_index),
                    request_id: request_id.to_string(),
                    text,
                }),
            }
        }
    }
}
