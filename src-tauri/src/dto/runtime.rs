use std::collections::HashSet;
use std::path::Path;
use std::process::Command;

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::session::ChatBindingDto;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename = "RuntimeStatus")]
pub struct RuntimeStatusDto {
    pub workspace_path: Option<String>,
    pub workspace_name: Option<String>,
    pub git_repo_name: Option<String>,
    pub git_branch_name: Option<String>,
    pub git_branches: Vec<String>,
    pub available_open_targets: Vec<String>,
    pub configured: bool,
    pub configuration_error: Option<String>,
}

impl RuntimeStatusDto {
    pub fn new(
        workspace_path: Option<&Path>,
        configured: bool,
        configuration_error: Option<String>,
    ) -> Self {
        let git_details = workspace_path.and_then(read_git_workspace_details);

        Self {
            workspace_path: workspace_path.map(|path| path.to_string_lossy().into_owned()),
            workspace_name: workspace_path
                .and_then(|path| path.file_name())
                .map(|name| name.to_string_lossy().into_owned()),
            git_repo_name: git_details
                .as_ref()
                .and_then(|details| details.repo_name.clone()),
            git_branch_name: git_details
                .as_ref()
                .and_then(|details| details.branch_name.clone()),
            git_branches: git_details
                .map(|details| details.branch_names)
                .unwrap_or_default(),
            available_open_targets: crate::desktop_open::detect_available_open_targets(),
            configured,
            configuration_error,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct GitWorkspaceDetails {
    repo_name: Option<String>,
    branch_name: Option<String>,
    branch_names: Vec<String>,
}

fn read_git_workspace_details(workspace_path: &Path) -> Option<GitWorkspaceDetails> {
    let repo_name = run_git_command(workspace_path, &["remote", "get-url", "origin"])
        .and_then(|remote_url| parse_git_remote_name(&remote_url));
    let branch_name = run_git_command(workspace_path, &["rev-parse", "--abbrev-ref", "HEAD"])
        .or_else(|| {
            run_git_command(
                workspace_path,
                &["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
            )
        });
    let local_branch_names = run_git_lines_command(
        workspace_path,
        &["for-each-ref", "--format=%(refname:short)", "refs/heads"],
    )
    .unwrap_or_default();
    let local_branch_name_set = local_branch_names.iter().cloned().collect::<HashSet<_>>();
    let remote_branch_names = run_git_lines_command(
        workspace_path,
        &["for-each-ref", "--format=%(refname:short)", "refs/remotes"],
    )
    .unwrap_or_default()
    .into_iter()
    .filter(|candidate| candidate.contains('/') && !candidate.ends_with("/HEAD"))
    .filter(|candidate| {
        let local_equivalent = candidate
            .split_once('/')
            .map(|(_, remainder)| remainder)
            .unwrap_or(candidate.as_str());
        !local_branch_name_set.contains(local_equivalent)
    })
    .collect::<Vec<_>>();
    let mut seen_branch_names = HashSet::new();
    let branch_names = local_branch_names
        .into_iter()
        .chain(remote_branch_names)
        .filter(|candidate| seen_branch_names.insert(candidate.clone()))
        .collect::<Vec<_>>();

    if repo_name.is_none() && branch_name.is_none() && branch_names.is_empty() {
        return None;
    }

    Some(GitWorkspaceDetails {
        repo_name,
        branch_name,
        branch_names,
    })
}

fn run_git_command(workspace_path: &Path, args: &[&str]) -> Option<String> {
    let mut values = run_git_lines_command(workspace_path, args)?;
    values.retain(|value| value != "HEAD");
    values.into_iter().next()
}

fn run_git_lines_command(workspace_path: &Path, args: &[&str]) -> Option<Vec<String>> {
    let output = Command::new("git")
        .args(args)
        .current_dir(workspace_path)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }

    let value = String::from_utf8(output.stdout).ok()?;
    let values = value
        .lines()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();
    if values.is_empty() {
        return None;
    }

    Some(values)
}

fn parse_git_remote_name(remote_url: &str) -> Option<String> {
    let normalized = remote_url
        .trim()
        .trim_end_matches('/')
        .trim_end_matches(".git");
    let path = if let Some((_, remainder)) = normalized.split_once("://") {
        remainder.split_once('/').map(|(_, path)| path)?
    } else if normalized.contains('@') && normalized.contains(':') {
        normalized.rsplit_once(':').map(|(_, path)| path)?
    } else {
        normalized
    };

    let segments = path
        .split('/')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>();

    if segments.len() < 2 {
        return None;
    }

    Some(format!(
        "{}/{}",
        segments[segments.len() - 2],
        segments[segments.len() - 1]
    ))
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename = "PromptModelOption")]
pub struct PromptModelOptionDto {
    pub provider_id: String,
    pub provider_name: String,
    pub model_id: String,
    pub model_name: Option<String>,
    pub context_length: Option<u64>,
    pub supports_reasoning: bool,
    pub reasoning_efforts: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename = "PromptSettings")]
pub struct PromptSettingsDto {
    pub available_models: Vec<PromptModelOptionDto>,
    pub selected_provider_id: Option<String>,
    pub selected_model_id: Option<String>,
    pub selected_reasoning_effort: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename = "UpdatePromptSettingsInput")]
pub struct UpdatePromptSettingsInput {
    pub workspace_path: Option<String>,
    pub provider_id: String,
    pub model_id: String,
    pub reasoning_effort: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "camelCase")]
pub struct SendPromptInput {
    pub workspace_path: String,
    pub prompt: String,
    pub conversation_id: Option<String>,
    pub agent_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename = "CloneRepositoryInput")]
pub struct CloneRepositoryInput {
    pub repository_url: String,
    pub parent_directory: String,
    pub directory_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename = "QuickStartVisibility")]
pub enum QuickStartVisibility {
    Public,
    Private,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename = "QuickStartProjectInput")]
pub struct QuickStartProjectInput {
    pub project_name: String,
    pub parent_directory: String,
    pub visibility: QuickStartVisibility,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename = "CheckoutGitBranchInput")]
pub struct CheckoutGitBranchInput {
    pub workspace_path: String,
    pub branch_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename = "CreateGitBranchInput")]
pub struct CreateGitBranchInput {
    pub workspace_path: String,
    pub branch_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename = "CommitGitChangesInput")]
pub struct CommitGitChangesInput {
    pub workspace_path: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename = "CreateSavedWorkspaceInput")]
pub struct CreateSavedWorkspaceInput {
    pub chats: Vec<ChatBindingDto>,
    pub layout_json: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename = "UpdateSavedWorkspaceLayoutInput")]
pub struct UpdateSavedWorkspaceLayoutInput {
    pub workspace_id: String,
    pub layout_json: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename = "SaveConversationLayoutInput")]
pub struct SaveConversationLayoutInput {
    pub conversation_id: String,
    pub layout_json: String,
}
