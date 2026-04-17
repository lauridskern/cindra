use crate::dto::{
    CheckoutGitBranchInput, CloneRepositoryInput, CommitGitChangesInput, ConversationTranscriptDto,
    CreateGitBranchInput, FollowupResponseDto, ProjectSummaryDto, QuickStartProjectInput,
    QuickStartVisibility, ResetChatResultDto, RuntimeStatusDto, SendPromptInput,
    SendPromptResultDto,
};
use crate::runtime::DesktopState;
use anyhow::Context;
use std::path::{Path, PathBuf};
use std::process::Command;
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

#[tauri::command]
pub(crate) async fn clone_repository(input: CloneRepositoryInput) -> Result<String, String> {
    clone_repository_to_directory(input).map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn quick_start_project(input: QuickStartProjectInput) -> Result<String, String> {
    create_github_project(input).map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn checkout_git_branch(
    input: CheckoutGitBranchInput,
    state: tauri::State<'_, DesktopState>,
) -> Result<RuntimeStatusDto, String> {
    state
        .manager
        .checkout_git_branch(input.branch_name)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn create_git_branch(
    input: CreateGitBranchInput,
    state: tauri::State<'_, DesktopState>,
) -> Result<RuntimeStatusDto, String> {
    state
        .manager
        .create_git_branch(input.branch_name)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn commit_git_changes(
    input: CommitGitChangesInput,
    state: tauri::State<'_, DesktopState>,
) -> Result<RuntimeStatusDto, String> {
    state
        .manager
        .commit_git_changes(input.message)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn push_git_branch(
    state: tauri::State<'_, DesktopState>,
) -> Result<RuntimeStatusDto, String> {
    state
        .manager
        .push_git_branch()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn open_in_target(
    target_id: String,
    state: tauri::State<'_, DesktopState>,
) -> Result<(), String> {
    state
        .manager
        .open_in_target(target_id)
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
