use std::path::PathBuf;
use std::sync::Arc;

use forge_domain::ConversationId;
use tokio::sync::Mutex;

use crate::bridge::emitter::UiEventEmitter;
use crate::bridge::followup::FollowupBridge;
use crate::persistence::project_store::ProjectStore;

use super::{ForgeRuntime, RuntimeManager};

#[derive(Clone, Default)]
pub(crate) struct RuntimeState {
    pub(crate) workspace_path: Option<PathBuf>,
    pub(crate) runtime: Option<ForgeRuntime>,
    pub(crate) conversation_id: Option<ConversationId>,
    pub(crate) active_request_id: Option<String>,
}

pub(crate) fn shared_runtime_state() -> Arc<Mutex<RuntimeState>> {
    Arc::new(Mutex::new(RuntimeState::default()))
}

pub struct DesktopState {
    pub manager: Arc<RuntimeManager>,
}

impl DesktopState {
    pub fn new(emitter: Arc<dyn UiEventEmitter>, projects: Arc<ProjectStore>) -> Self {
        let followups = Arc::new(FollowupBridge::new(emitter.clone()));
        let manager = RuntimeManager::new(emitter, followups, projects);
        Self {
            manager: Arc::new(manager),
        }
    }
}
