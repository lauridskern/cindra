mod commands;
mod desktop_open;
pub mod dto;
mod runtime;

mod bridge {
    pub mod desktop_infra;
    pub mod emitter;
    pub mod followup;
}

mod persistence {
    pub mod project_store;
}

use std::sync::Arc;

use bridge::emitter::TauriEventEmitter;
use commands::{
    checkout_git_branch, clone_repository, commit_git_changes, create_git_branch,
    get_runtime_status, get_session_snapshot, open_in_target, open_workspace, pick_directory,
    pick_workspace, push_git_branch, quick_start_project, respond_followup, select_conversation,
    send_prompt, start_new_chat,
};
use persistence::project_store::ProjectStore;
use runtime::DesktopState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_dialog::init());
    #[cfg(debug_assertions)]
    let builder = builder.plugin(
        tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
    );

    builder
        .setup(|app| {
            let emitter = Arc::new(TauriEventEmitter::new(app.handle().clone()));
            let app_dir = app
                .path()
                .app_data_dir()
                .map_err(|error| anyhow::anyhow!(error.to_string()))?;
            let projects = Arc::new(ProjectStore::new(app_dir.join("projects.db"))?);
            app.manage(DesktopState::new(emitter, projects));
            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                let manager = window.state::<DesktopState>().manager.clone();
                tauri::async_runtime::spawn(async move {
                    manager.cancel_pending_followups().await;
                });
            }
        })
        .invoke_handler(tauri::generate_handler![
            pick_workspace,
            pick_directory,
            open_workspace,
            get_runtime_status,
            get_session_snapshot,
            select_conversation,
            start_new_chat,
            send_prompt,
            respond_followup,
            clone_repository,
            quick_start_project,
            checkout_git_branch,
            create_git_branch,
            commit_git_changes,
            push_git_branch,
            open_in_target
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
