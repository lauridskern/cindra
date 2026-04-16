use anyhow::Result;
use tauri::Emitter;

use crate::dto::SessionSnapshotDto;

pub const SESSION_UPDATED_EVENT_NAME: &str = "agent-ui://session-updated";

pub trait UiEventEmitter: Send + Sync {
    fn emit_session_updated(&self, payload: SessionSnapshotDto) -> Result<()>;
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
    fn emit_session_updated(&self, payload: SessionSnapshotDto) -> Result<()> {
        self.app.emit(SESSION_UPDATED_EVENT_NAME, payload)?;
        Ok(())
    }
}
