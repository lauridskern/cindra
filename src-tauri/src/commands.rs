use crate::dto::{
    ChatBindingDto, CheckoutGitBranchInput, CloneRepositoryInput, CommitGitChangesInput,
    CompleteProviderAuthInput, CreateGitBranchInput, CreateSavedWorkspaceInput,
    FollowupResponseDto, HandoffChatInput, PromptSettingsDto, ProviderAuthSessionDto,
    ProviderSummaryDto, QuickStartProjectInput, QuickStartVisibility, RemoveProviderInput,
    RuntimeStatusDto, SaveConversationLayoutInput, SendPromptInput, SessionSnapshotDto,
    StartProviderAuthInput, TerminalCloseInput, TerminalOpenInput, TerminalResizeInput,
    TerminalSessionDto, TerminalWriteInput, UpdatePromptSettingsInput,
    UpdateSavedWorkspaceLayoutInput,
};
use crate::runtime::{DesktopState, format_error_chain};
use anyhow::Context;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri_plugin_dialog::{DialogExt, FilePath};

const DEFAULT_WORKSPACE_FILE_SEARCH_LIMIT: usize = 50;
const MAX_WORKSPACE_FILE_SEARCH_LIMIT: usize = 100;
const MAX_WORKSPACE_FILE_SCAN_ENTRIES: usize = 10_000;
const IGNORED_WORKSPACE_FILE_DIRS: &[&str] = &[
    ".git",
    ".cache",
    ".next",
    ".turbo",
    ".venv",
    "build",
    "dist",
    "node_modules",
    "out",
    "target",
    "vendor",
    "venv",
];

fn map_command_error(error: anyhow::Error) -> String {
    format_error_chain(&error)
}

fn normalize_file_search_query(query: Option<&str>) -> Vec<String> {
    query
        .unwrap_or_default()
        .split(|character: char| character.is_whitespace() || character == '/')
        .map(str::trim)
        .filter(|token| !token.is_empty())
        .map(|token| token.to_lowercase())
        .collect()
}

fn is_ignored_workspace_file_dir(path: &Path) -> bool {
    let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
        return false;
    };

    IGNORED_WORKSPACE_FILE_DIRS
        .iter()
        .any(|ignored| name.eq_ignore_ascii_case(ignored))
}

fn relative_workspace_file_path(workspace_path: &Path, file_path: &Path) -> Option<String> {
    let relative = file_path.strip_prefix(workspace_path).ok()?;
    let normalized = relative.to_string_lossy().replace('\\', "/");

    if normalized.is_empty() {
        None
    } else {
        Some(normalized)
    }
}

fn workspace_file_matches_query(path: &str, query_tokens: &[String]) -> bool {
    if query_tokens.is_empty() {
        return true;
    }

    let normalized_path = path.to_lowercase();
    query_tokens
        .iter()
        .all(|token| normalized_path.contains(token))
}

fn workspace_file_rank(path: &str, query_tokens: &[String]) -> (usize, usize, String) {
    if query_tokens.is_empty() {
        return (0, path.len(), path.to_string());
    }

    let normalized_path = path.to_lowercase();
    let normalized_name = normalized_path
        .rsplit('/')
        .next()
        .unwrap_or(&normalized_path);
    let first_token = query_tokens.first().map(String::as_str).unwrap_or_default();
    let match_rank = if normalized_name == first_token {
        0
    } else if normalized_name.starts_with(first_token) {
        1
    } else if normalized_path.starts_with(first_token) {
        2
    } else if normalized_name.contains(first_token) {
        3
    } else {
        4
    };

    (match_rank, path.len(), path.to_string())
}

fn search_workspace_file_paths(
    workspace_path: &Path,
    query_tokens: &[String],
    limit: usize,
) -> anyhow::Result<Vec<String>> {
    let mut directories = vec![workspace_path.to_path_buf()];
    let mut files = Vec::new();
    let mut scanned_entries = 0usize;

    while let Some(directory) = directories.pop() {
        if scanned_entries >= MAX_WORKSPACE_FILE_SCAN_ENTRIES {
            break;
        }

        let mut entries = fs::read_dir(&directory)
            .with_context(|| format!("Failed to read {}", directory.display()))?
            .filter_map(Result::ok)
            .collect::<Vec<_>>();
        entries.sort_by_key(|entry| entry.path());

        for entry in entries {
            if scanned_entries >= MAX_WORKSPACE_FILE_SCAN_ENTRIES {
                break;
            }
            scanned_entries += 1;

            let path = entry.path();
            let Ok(file_type) = entry.file_type() else {
                continue;
            };

            if file_type.is_dir() {
                if !is_ignored_workspace_file_dir(&path) {
                    directories.push(path);
                }
                continue;
            }

            if !file_type.is_file() {
                continue;
            }

            let Some(relative_path) = relative_workspace_file_path(workspace_path, &path) else {
                continue;
            };

            if workspace_file_matches_query(&relative_path, query_tokens) {
                files.push(relative_path);
            }
        }
    }

    files.sort_by_key(|path| workspace_file_rank(path, query_tokens));
    files.truncate(limit);
    Ok(files)
}

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
pub(crate) async fn pick_directory(
    app: tauri::AppHandle,
    title: Option<String>,
) -> Result<Option<String>, String> {
    let mut dialog = app.dialog().file();
    if let Some(title) = title {
        dialog = dialog.set_title(&title);
    }

    Ok(dialog.blocking_pick_folder().and_then(file_path_to_string))
}

#[tauri::command]
pub(crate) async fn search_workspace_files(
    workspace_path: String,
    query: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<String>, String> {
    let result = || -> anyhow::Result<Vec<String>> {
        let workspace_path = PathBuf::from(workspace_path.trim())
            .canonicalize()
            .context("Failed to resolve workspace path")?;
        if !workspace_path.is_dir() {
            anyhow::bail!("Workspace path is not a directory.");
        }

        let query_tokens = normalize_file_search_query(query.as_deref());
        let limit = limit
            .unwrap_or(DEFAULT_WORKSPACE_FILE_SEARCH_LIMIT)
            .clamp(1, MAX_WORKSPACE_FILE_SEARCH_LIMIT);

        search_workspace_file_paths(&workspace_path, &query_tokens, limit)
    };

    result().map_err(map_command_error)
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
        .map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn get_runtime_status(
    workspace_path: Option<String>,
    state: tauri::State<'_, DesktopState>,
) -> Result<RuntimeStatusDto, String> {
    state
        .manager
        .get_runtime_status(workspace_path)
        .await
        .map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn get_session_snapshot(
    state: tauri::State<'_, DesktopState>,
) -> Result<SessionSnapshotDto, String> {
    state
        .manager
        .get_session_snapshot()
        .await
        .map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn get_prompt_settings(
    workspace_path: Option<String>,
    state: tauri::State<'_, DesktopState>,
) -> Result<PromptSettingsDto, String> {
    state
        .manager
        .get_prompt_settings(workspace_path)
        .await
        .map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn list_providers(
    workspace_path: Option<String>,
    state: tauri::State<'_, DesktopState>,
) -> Result<Vec<ProviderSummaryDto>, String> {
    state
        .manager
        .list_providers(workspace_path)
        .await
        .map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn start_provider_auth(
    input: StartProviderAuthInput,
    state: tauri::State<'_, DesktopState>,
) -> Result<ProviderAuthSessionDto, String> {
    state
        .manager
        .start_provider_auth(input)
        .await
        .map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn complete_provider_auth(
    input: CompleteProviderAuthInput,
    state: tauri::State<'_, DesktopState>,
) -> Result<ProviderSummaryDto, String> {
    state
        .manager
        .complete_provider_auth(input)
        .await
        .map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn remove_provider(
    input: RemoveProviderInput,
    state: tauri::State<'_, DesktopState>,
) -> Result<ProviderSummaryDto, String> {
    state
        .manager
        .remove_provider(input)
        .await
        .map_err(map_command_error)
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
        .map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn stop_prompt(
    input: ChatBindingDto,
    state: tauri::State<'_, DesktopState>,
) -> Result<(), String> {
    state
        .manager
        .stop_prompt(input)
        .await
        .map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn update_prompt_settings(
    input: UpdatePromptSettingsInput,
    state: tauri::State<'_, DesktopState>,
) -> Result<PromptSettingsDto, String> {
    state
        .manager
        .update_prompt_settings(input)
        .await
        .map_err(map_command_error)
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
        .map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn ensure_conversation_view(
    workspace_path: String,
    conversation_id: String,
    state: tauri::State<'_, DesktopState>,
) -> Result<SessionSnapshotDto, String> {
    state
        .manager
        .ensure_conversation_view(workspace_path, conversation_id)
        .await
        .map_err(map_command_error)
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
        .map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn create_managed_chat(
    state: tauri::State<'_, DesktopState>,
) -> Result<SessionSnapshotDto, String> {
    state
        .manager
        .create_managed_chat()
        .await
        .map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn handoff_chat(
    input: HandoffChatInput,
    state: tauri::State<'_, DesktopState>,
) -> Result<SessionSnapshotDto, String> {
    state
        .manager
        .handoff_chat(input)
        .await
        .map_err(map_command_error)
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
        .map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn archive_conversation(
    workspace_path: String,
    conversation_id: String,
    state: tauri::State<'_, DesktopState>,
) -> Result<SessionSnapshotDto, String> {
    state
        .manager
        .archive_conversation(workspace_path, conversation_id)
        .await
        .map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn archive_workspace(
    workspace_path: String,
    state: tauri::State<'_, DesktopState>,
) -> Result<SessionSnapshotDto, String> {
    state
        .manager
        .archive_workspace(workspace_path)
        .await
        .map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn rename_workspace(
    workspace_path: String,
    display_name: Option<String>,
    state: tauri::State<'_, DesktopState>,
) -> Result<SessionSnapshotDto, String> {
    state
        .manager
        .rename_workspace(workspace_path, display_name)
        .await
        .map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn clone_repository(input: CloneRepositoryInput) -> Result<String, String> {
    clone_repository_to_directory(input).map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn quick_start_project(input: QuickStartProjectInput) -> Result<String, String> {
    create_github_project(input).map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn checkout_git_branch(
    input: CheckoutGitBranchInput,
    state: tauri::State<'_, DesktopState>,
) -> Result<RuntimeStatusDto, String> {
    state
        .manager
        .checkout_git_branch(input.workspace_path, input.branch_name)
        .await
        .map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn create_git_branch(
    input: CreateGitBranchInput,
    state: tauri::State<'_, DesktopState>,
) -> Result<RuntimeStatusDto, String> {
    state
        .manager
        .create_git_branch(input.workspace_path, input.branch_name)
        .await
        .map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn commit_git_changes(
    input: CommitGitChangesInput,
    state: tauri::State<'_, DesktopState>,
) -> Result<RuntimeStatusDto, String> {
    state
        .manager
        .commit_git_changes(input.workspace_path, input.message)
        .await
        .map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn push_git_branch(
    workspace_path: String,
    state: tauri::State<'_, DesktopState>,
) -> Result<RuntimeStatusDto, String> {
    state
        .manager
        .push_git_branch(workspace_path)
        .await
        .map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn open_in_target(
    workspace_path: String,
    target_id: String,
    state: tauri::State<'_, DesktopState>,
) -> Result<(), String> {
    state
        .manager
        .open_in_target(workspace_path, target_id)
        .await
        .map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn open_path_in_target(
    workspace_path: String,
    target_id: String,
    path: String,
    state: tauri::State<'_, DesktopState>,
) -> Result<(), String> {
    state
        .manager
        .open_path_in_target(workspace_path, target_id, path)
        .await
        .map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn open_external_url(url: String) -> Result<(), String> {
    crate::desktop_open::open_external_url(&url).map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn save_conversation_layout(
    input: SaveConversationLayoutInput,
    state: tauri::State<'_, DesktopState>,
) -> Result<(), String> {
    state
        .manager
        .save_conversation_layout(input)
        .await
        .map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn get_conversation_layout(
    conversation_id: String,
    state: tauri::State<'_, DesktopState>,
) -> Result<Option<String>, String> {
    state
        .manager
        .get_conversation_layout(conversation_id)
        .await
        .map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn create_saved_workspace(
    input: CreateSavedWorkspaceInput,
    state: tauri::State<'_, DesktopState>,
) -> Result<crate::dto::SavedWorkspaceDetailDto, String> {
    state
        .manager
        .create_saved_workspace(input)
        .await
        .map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn update_saved_workspace_layout(
    input: UpdateSavedWorkspaceLayoutInput,
    state: tauri::State<'_, DesktopState>,
) -> Result<crate::dto::SavedWorkspaceDetailDto, String> {
    state
        .manager
        .update_saved_workspace_layout(input)
        .await
        .map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn get_saved_workspace(
    workspace_id: String,
    state: tauri::State<'_, DesktopState>,
) -> Result<Option<crate::dto::SavedWorkspaceDetailDto>, String> {
    state
        .manager
        .get_saved_workspace(workspace_id)
        .await
        .map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn rename_saved_workspace(
    workspace_id: String,
    name: String,
    state: tauri::State<'_, DesktopState>,
) -> Result<SessionSnapshotDto, String> {
    state
        .manager
        .rename_saved_workspace(workspace_id, name)
        .await
        .map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn delete_saved_workspace(
    workspace_id: String,
    state: tauri::State<'_, DesktopState>,
) -> Result<SessionSnapshotDto, String> {
    state
        .manager
        .delete_saved_workspace(workspace_id)
        .await
        .map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn terminal_open(
    input: TerminalOpenInput,
    state: tauri::State<'_, DesktopState>,
) -> Result<TerminalSessionDto, String> {
    state
        .terminal_manager
        .open(input)
        .await
        .map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn terminal_write(
    input: TerminalWriteInput,
    state: tauri::State<'_, DesktopState>,
) -> Result<(), String> {
    state
        .terminal_manager
        .write(input)
        .await
        .map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn terminal_resize(
    input: TerminalResizeInput,
    state: tauri::State<'_, DesktopState>,
) -> Result<(), String> {
    state
        .terminal_manager
        .resize(input)
        .await
        .map_err(map_command_error)
}

#[tauri::command]
pub(crate) async fn terminal_close(
    input: TerminalCloseInput,
    state: tauri::State<'_, DesktopState>,
) -> Result<(), String> {
    state
        .terminal_manager
        .close(input)
        .await
        .map_err(map_command_error)
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

fn clone_repository_to_directory(input: CloneRepositoryInput) -> anyhow::Result<String> {
    let repository_url = input.repository_url.trim();
    if repository_url.is_empty() {
        anyhow::bail!("Repository URL cannot be empty.");
    }

    let parent_directory = canonicalize_existing_directory(&input.parent_directory)?;
    let directory_name = validate_directory_name(&input.directory_name)?;
    let target_directory = parent_directory.join(&directory_name);
    ensure_directory_is_available(&target_directory)?;

    let mut command = Command::new("git");
    command
        .arg("clone")
        .arg(repository_url)
        .arg(&target_directory)
        .current_dir(&parent_directory);
    run_command(&mut command, "git clone")?;

    canonicalize_output_directory(&target_directory)
}

fn create_github_project(input: QuickStartProjectInput) -> anyhow::Result<String> {
    let parent_directory = canonicalize_existing_directory(&input.parent_directory)?;
    let project_name = validate_directory_name(&input.project_name)?;
    let target_directory = parent_directory.join(&project_name);
    ensure_directory_is_available(&target_directory)?;

    let visibility_flag = match input.visibility {
        QuickStartVisibility::Public => "--public",
        QuickStartVisibility::Private => "--private",
    };

    let mut command = Command::new("gh");
    command
        .arg("repo")
        .arg("create")
        .arg(&project_name)
        .arg(visibility_flag)
        .arg("--clone")
        .arg("--add-readme")
        .current_dir(&parent_directory);
    run_command(&mut command, "gh repo create")?;

    canonicalize_output_directory(&target_directory)
}

fn canonicalize_existing_directory(path: &str) -> anyhow::Result<PathBuf> {
    let candidate = PathBuf::from(path.trim());
    if path.trim().is_empty() {
        anyhow::bail!("Directory cannot be empty.");
    }

    if !candidate.exists() {
        anyhow::bail!("Directory does not exist: {}", candidate.display());
    }

    if !candidate.is_dir() {
        anyhow::bail!("Expected a directory: {}", candidate.display());
    }

    candidate
        .canonicalize()
        .with_context(|| format!("Failed to access {}", candidate.display()))
}

fn canonicalize_output_directory(path: &Path) -> anyhow::Result<String> {
    Ok(path
        .canonicalize()
        .with_context(|| format!("Failed to access {}", path.display()))?
        .to_string_lossy()
        .into_owned())
}

fn validate_directory_name(value: &str) -> anyhow::Result<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        anyhow::bail!("Name cannot be empty.");
    }

    if trimmed == "." || trimmed == ".." {
        anyhow::bail!("Choose a different name.");
    }

    if trimmed.contains('/') || trimmed.contains('\\') {
        anyhow::bail!("Name cannot contain path separators.");
    }

    Ok(trimmed.to_string())
}

fn ensure_directory_is_available(path: &Path) -> anyhow::Result<()> {
    if path.exists() {
        anyhow::bail!("{} already exists.", path.display());
    }

    Ok(())
}

fn run_command(command: &mut Command, description: &str) -> anyhow::Result<()> {
    let output = command
        .output()
        .with_context(|| format!("Failed to launch {description}. Make sure it is installed."))?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let details = if !stderr.is_empty() {
        stderr
    } else if !stdout.is_empty() {
        stdout
    } else {
        format!("{description} exited with status {}", output.status)
    };

    anyhow::bail!("{details}")
}
