use std::path::Path;
use std::sync::{Arc, Mutex, MutexGuard};

use tempfile::TempDir;

use crate::persistence::project_store::ProjectStore;

static ENV_MUTEX: Mutex<()> = Mutex::new(());

pub struct EnvGuard {
    _lock: MutexGuard<'static, ()>,
}

impl EnvGuard {
    pub fn set_config_dir(path: &Path) -> Self {
        let lock = ENV_MUTEX.lock().expect("env mutex");
        unsafe { std::env::set_var("FORGE_CONFIG", path) };
        Self { _lock: lock }
    }
}

impl Drop for EnvGuard {
    fn drop(&mut self) {
        unsafe { std::env::remove_var("FORGE_CONFIG") };
    }
}

pub fn create_project_store(root: &TempDir) -> Arc<ProjectStore> {
    Arc::new(ProjectStore::new(root.path().join("projects.db")).expect("project store"))
}
