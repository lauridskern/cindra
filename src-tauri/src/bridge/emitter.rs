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
