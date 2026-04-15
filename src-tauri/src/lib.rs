mod desktop_infra;
mod dto;
mod emitter;
mod followup;
mod project_registry;
mod runtime;

use std::sync::Arc;

use dto::{
    FollowupResponseDto, HistoricalConversationDto, RuntimeStatusDto, SendPromptInput,
    SendPromptResultDto, WorkspaceConversationGroupDto,
};
use emitter::TauriEventEmitter;
use project_registry::ProjectRegistry;
use runtime::DesktopState;
use tauri::Manager;
use tauri_plugin_dialog::{DialogExt, FilePath};

#[tauri::command]
async fn pick_workspace(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let selected = app
        .dialog()
        .file()
        .set_title("Open project folder")
        .blocking_pick_folder();

    Ok(selected.and_then(file_path_to_string))
}

#[tauri::command]
async fn open_workspace(
    path: String,
    state: tauri::State<'_, DesktopState>,
) -> Result<RuntimeStatusDto, String> {
    state
        .manager
        .open_workspace(path.into())
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn get_runtime_status(
    state: tauri::State<'_, DesktopState>,
) -> Result<RuntimeStatusDto, String> {
    state
        .manager
        .get_runtime_status()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn send_prompt(
    input: SendPromptInput,
    state: tauri::State<'_, DesktopState>,
) -> Result<SendPromptResultDto, String> {
    state
        .manager
        .send_prompt(input)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn list_projects(
    state: tauri::State<'_, DesktopState>,
) -> Result<Vec<WorkspaceConversationGroupDto>, String> {
    state
        .manager
        .list_projects()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn load_conversation(
    conversation_id: String,
    state: tauri::State<'_, DesktopState>,
) -> Result<HistoricalConversationDto, String> {
    state
        .manager
        .load_conversation(conversation_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn respond_followup(
    response: FollowupResponseDto,
    state: tauri::State<'_, DesktopState>,
) -> Result<(), String> {
    state
        .manager
        .respond_followup(response)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn reset_chat(
    state: tauri::State<'_, DesktopState>,
) -> Result<dto::ResetChatResultDto, String> {
    state
        .manager
        .reset_chat()
        .await
        .map_err(|error| error.to_string())
}

fn file_path_to_string(path: FilePath) -> Option<String> {
    match path {
        FilePath::Path(path) => Some(path.to_string_lossy().into_owned()),
        FilePath::Url(url) => url
            .to_file_path()
            .ok()
            .map(|path| path.to_string_lossy().into_owned())
            .or_else(|| Some(url.to_string())),
    }
}

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
            let registry = Arc::new(ProjectRegistry::new(app_dir.join("projects.db"))?);
            app.manage(DesktopState::new(emitter, registry));
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
            open_workspace,
            get_runtime_status,
            list_projects,
            load_conversation,
            send_prompt,
            respond_followup,
            reset_chat
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
