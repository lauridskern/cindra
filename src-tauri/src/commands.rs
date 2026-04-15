use crate::dto::{
    ConversationTranscriptDto, FollowupResponseDto, ProjectSummaryDto, ResetChatResultDto,
    RuntimeStatusDto, SendPromptInput, SendPromptResultDto,
};
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
) -> Result<RuntimeStatusDto, String> {
    state
        .manager
        .open_workspace(path.into())
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn get_runtime_status(
    state: tauri::State<'_, DesktopState>,
) -> Result<RuntimeStatusDto, String> {
    state
        .manager
        .get_runtime_status()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn send_prompt(
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
pub(crate) async fn list_projects(
    state: tauri::State<'_, DesktopState>,
) -> Result<Vec<ProjectSummaryDto>, String> {
    state
        .manager
        .list_projects()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn load_conversation(
    conversation_id: String,
    state: tauri::State<'_, DesktopState>,
) -> Result<ConversationTranscriptDto, String> {
    state
        .manager
        .load_conversation(conversation_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn respond_followup(
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
pub(crate) async fn reset_chat(
    state: tauri::State<'_, DesktopState>,
) -> Result<ResetChatResultDto, String> {
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
