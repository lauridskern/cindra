mod commands;
mod desktop_open;
pub mod dto;
mod forge_config_home;
mod runtime;
mod terminal;

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
    archive_conversation, archive_workspace, checkout_git_branch, clone_repository,
    commit_git_changes, complete_provider_auth, create_git_branch, create_managed_chat,
    create_saved_workspace, delete_saved_workspace, ensure_conversation_view,
    get_conversation_layout, get_forge_config_file, get_prompt_settings, get_runtime_status,
    get_saved_workspace, get_session_snapshot, handoff_chat, list_providers, open_external_url,
    open_in_target, open_path_in_target, open_workspace, pick_directory, pick_workspace,
    push_git_branch, quick_start_project, remove_provider, rename_saved_workspace,
    rename_workspace, respond_followup, save_conversation_layout, select_conversation, send_prompt,
    start_new_chat, start_provider_auth, stop_prompt, terminal_close, terminal_open,
    terminal_resize, terminal_write, update_forge_config_file, update_prompt_settings,
    update_saved_workspace_layout,
};
use persistence::project_store::ProjectStore;
use runtime::DesktopState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    install_rustls_crypto_provider();

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
            let home_dir = app.path().home_dir().ok();
            forge_config_home::initialize_app_forge_config(&app_dir, home_dir.as_deref())?;
            let projects = Arc::new(ProjectStore::new(
                app_dir.join("projects.db"),
                app_dir.join("managed-chats"),
            )?);
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
            get_prompt_settings,
            get_forge_config_file,
            update_forge_config_file,
            list_providers,
            select_conversation,
            ensure_conversation_view,
            start_new_chat,
            create_managed_chat,
            handoff_chat,
            send_prompt,
            stop_prompt,
            update_prompt_settings,
            start_provider_auth,
            complete_provider_auth,
            remove_provider,
            respond_followup,
            archive_conversation,
            archive_workspace,
            rename_workspace,
            clone_repository,
            quick_start_project,
            checkout_git_branch,
            create_git_branch,
            commit_git_changes,
            push_git_branch,
            open_in_target,
            open_path_in_target,
            open_external_url,
            save_conversation_layout,
            get_conversation_layout,
            create_saved_workspace,
            update_saved_workspace_layout,
            get_saved_workspace,
            rename_saved_workspace,
            delete_saved_workspace,
            terminal_open,
            terminal_write,
            terminal_resize,
            terminal_close
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn install_rustls_crypto_provider() {
    if rustls::crypto::CryptoProvider::get_default().is_some() {
        return;
    }

    let _ = rustls::crypto::ring::default_provider().install_default();
}
