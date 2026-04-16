use crate::dto::{FollowupResponseDto, SendPromptInput, SessionSnapshotDto};
use crate::runtime::DesktopState;
use tauri_plugin_dialog::{DialogExt, FilePath};

#[tauri::command]
pub(crate) async fn pick_workspace(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let selected = app
        .dialog()
        .file()
        .set_title("Open project folder")
        .blocking_pick_folder();

    Ok(selected.and_then(file_path_to_string))
}

#[tauri::command]
pub(crate) async fn open_workspace(
    path: String,
    state: tauri::State<'_, DesktopState>,
) -> Result<SessionSnapshotDto, String> {
    state
        .manager
        .open_workspace(path.into())
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn get_session_snapshot(
    state: tauri::State<'_, DesktopState>,
) -> Result<SessionSnapshotDto, String> {
    state
        .manager
        .get_session_snapshot()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn send_prompt(
    input: SendPromptInput,
    state: tauri::State<'_, DesktopState>,
) -> Result<SessionSnapshotDto, String> {
    state
        .manager
        .send_prompt(input)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn select_conversation(
    workspace_path: String,
    conversation_id: String,
    state: tauri::State<'_, DesktopState>,
) -> Result<SessionSnapshotDto, String> {
    state
        .manager
        .select_conversation(workspace_path, conversation_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn start_new_chat(
    workspace_path: String,
    state: tauri::State<'_, DesktopState>,
) -> Result<SessionSnapshotDto, String> {
    state
        .manager
        .start_new_chat(workspace_path)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn respond_followup(
    response: FollowupResponseDto,
    state: tauri::State<'_, DesktopState>,
) -> Result<SessionSnapshotDto, String> {
    state
        .manager
        .respond_followup(response)
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
