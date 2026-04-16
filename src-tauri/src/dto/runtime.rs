use std::path::Path;
use std::process::Command;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStatusDto {
    pub workspace_path: Option<String>,
    pub workspace_name: Option<String>,
    pub git_repo_name: Option<String>,
    pub git_branch_name: Option<String>,
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
            git_branch_name: git_details.and_then(|details| details.branch_name),
            configured,
            configuration_error,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct GitWorkspaceDetails {
    repo_name: Option<String>,
    branch_name: Option<String>,
}

fn read_git_workspace_details(workspace_path: &Path) -> Option<GitWorkspaceDetails> {
    let repo_name = run_git_command(workspace_path, &["remote", "get-url", "origin"])
        .and_then(|remote_url| parse_git_remote_name(&remote_url));
    let branch_name = run_git_command(
        workspace_path,
        &["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
    )
    .or_else(|| run_git_command(workspace_path, &["rev-parse", "--abbrev-ref", "HEAD"]));

    if repo_name.is_none() && branch_name.is_none() {
        return None;
    }

    Some(GitWorkspaceDetails {
        repo_name,
        branch_name,
    })
}

fn run_git_command(workspace_path: &Path, args: &[&str]) -> Option<String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(workspace_path)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }

    let value = String::from_utf8(output.stdout).ok()?;
    let trimmed = value.trim();
    if trimmed.is_empty() || trimmed == "HEAD" {
        return None;
    }

    Some(trimmed.to_string())
}

fn parse_git_remote_name(remote_url: &str) -> Option<String> {
    let normalized = remote_url.trim().trim_end_matches('/').trim_end_matches(".git");
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SendPromptInput {
    pub prompt: String,
    pub conversation_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SendPromptResultDto {
    pub request_id: String,
    pub conversation_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ResetChatResultDto {
    pub conversation_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CloneRepositoryInput {
    pub repository_url: String,
    pub parent_directory: String,
    pub directory_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum QuickStartVisibility {
    Public,
    Private,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct QuickStartProjectInput {
    pub project_name: String,
    pub parent_directory: String,
    pub visibility: QuickStartVisibility,
}
