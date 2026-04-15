use anyhow::Result;
use tauri::Emitter;

use crate::dto::{ChatEventDto, FollowupRequestDto};

pub const CHAT_EVENT_NAME: &str = "forge://chat-event";
pub const FOLLOWUP_REQUEST_EVENT_NAME: &str = "forge://followup-request";

pub trait UiEventEmitter: Send + Sync {
    fn emit_chat(&self, payload: ChatEventDto) -> Result<()>;
    fn emit_followup(&self, payload: FollowupRequestDto) -> Result<()>;
}

#[derive(Clone)]
pub struct TauriEventEmitter {
    app: tauri::AppHandle,
}

impl TauriEventEmitter {
    pub fn new(app: tauri::AppHandle) -> Self {
        Self { app }
    }
}

impl UiEventEmitter for TauriEventEmitter {
    fn emit_chat(&self, payload: ChatEventDto) -> Result<()> {
        self.app.emit(CHAT_EVENT_NAME, payload)?;
        Ok(())
    }

    fn emit_followup(&self, payload: FollowupRequestDto) -> Result<()> {
        self.app.emit(FOLLOWUP_REQUEST_EVENT_NAME, payload)?;
        Ok(())
    }
}

#[cfg(test)]
use std::sync::{Arc, Mutex};

#[cfg(test)]
#[derive(Clone, Default)]
pub struct MemoryEventEmitter {
    chat_events: Arc<Mutex<Vec<ChatEventDto>>>,
    followup_requests: Arc<Mutex<Vec<FollowupRequestDto>>>,
}

#[cfg(test)]
impl MemoryEventEmitter {
    pub fn followup_requests(&self) -> Vec<FollowupRequestDto> {
        self.followup_requests
            .lock()
            .expect("followup mutex")
            .clone()
    }
}

#[cfg(test)]
impl UiEventEmitter for MemoryEventEmitter {
    fn emit_chat(&self, payload: ChatEventDto) -> Result<()> {
        self.chat_events
            .lock()
            .expect("chat event mutex")
            .push(payload);
        Ok(())
    }

    fn emit_followup(&self, payload: FollowupRequestDto) -> Result<()> {
        self.followup_requests
            .lock()
            .expect("followup mutex")
            .push(payload);
        Ok(())
    }
}
