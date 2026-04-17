use std::path::{Path, PathBuf};
use std::process::Command;

use anyhow::Context;

use crate::desktop_open;
use crate::dto::RuntimeStatusDto;

use super::RuntimeManager;

impl RuntimeManager {
    pub async fn checkout_git_branch(
        &self,
        branch_name: String,
    ) -> anyhow::Result<RuntimeStatusDto> {
        self.with_recorded_ui_error(async {
            let workspace_path = self.current_workspace_path().await?;
            let branch_name = validate_non_empty_value(&branch_name, "Branch name")?;

            if git_ref_exists(&workspace_path, &format!("refs/heads/{branch_name}"))? {
                run_git_command(&workspace_path, &["checkout", &branch_name], "git checkout")?;
            } else if git_ref_exists(&workspace_path, &format!("refs/remotes/{branch_name}"))? {
                let local_branch_name = branch_name
                    .rsplit('/')
                    .next()
                    .filter(|candidate| !candidate.is_empty())
                    .unwrap_or(branch_name.as_str());

                if git_ref_exists(&workspace_path, &format!("refs/heads/{local_branch_name}"))? {
                    run_git_command(
                        &workspace_path,
                        &["checkout", local_branch_name],
                        "git checkout",
                    )?;
                } else {
                    run_git_command(
                        &workspace_path,
                        &["checkout", "--track", &branch_name],
                        "git checkout --track",
                    )?;
                }
            } else {
                run_git_command(&workspace_path, &["checkout", &branch_name], "git checkout")?;
            }

            self.finish_runtime_status_action().await
        })
        .await
    }

    pub async fn create_git_branch(
        &self,
        branch_name: String,
    ) -> anyhow::Result<RuntimeStatusDto> {
        self.with_recorded_ui_error(async {
            let workspace_path = self.current_workspace_path().await?;
            let branch_name = validate_non_empty_value(&branch_name, "Branch name")?;

            run_git_command(
                &workspace_path,
                &["check-ref-format", "--branch", &branch_name],
                "git check-ref-format",
            )?;
            run_git_command(
                &workspace_path,
                &["checkout", "-b", &branch_name],
                "git checkout -b",
            )?;

            self.finish_runtime_status_action().await
        })
        .await
    }

    pub async fn commit_git_changes(&self, message: String) -> anyhow::Result<RuntimeStatusDto> {
        self.with_recorded_ui_error(async {
            let workspace_path = self.current_workspace_path().await?;
            let message = validate_non_empty_value(&message, "Commit message")?;

            run_git_command(&workspace_path, &["add", "-A"], "git add")?;
            run_git_command(&workspace_path, &["commit", "-m", &message], "git commit")?;

            self.finish_runtime_status_action().await
        })
        .await
    }

    pub async fn push_git_branch(&self) -> anyhow::Result<RuntimeStatusDto> {
        self.with_recorded_ui_error(async {
            let workspace_path = self.current_workspace_path().await?;
            let current_branch = run_git_stdout(
                &workspace_path,
                &["rev-parse", "--abbrev-ref", "HEAD"],
                "git rev-parse",
            )?;

            if current_branch == "HEAD" {
                anyhow::bail!("Cannot push from a detached HEAD state.");
            }

            if git_command_succeeds(
                &workspace_path,
                &[
                    "rev-parse",
                    "--abbrev-ref",
                    "--symbolic-full-name",
                    "@{upstream}",
                ],
            )? {
                run_git_command(&workspace_path, &["push"], "git push")?;
            } else {
                run_git_command(
                    &workspace_path,
                    &["push", "-u", "origin", &current_branch],
                    "git push -u",
                )?;
            }

            self.finish_runtime_status_action().await
        })
        .await
    }

    pub async fn open_in_target(&self, target_id: String) -> anyhow::Result<()> {
        self.with_recorded_ui_error(async {
            let workspace_path = self.current_workspace_path().await?;
            let target_id = validate_non_empty_value(&target_id, "Open target")?;
            desktop_open::open_path_in_target(&target_id, workspace_path.as_path())?;
            self.clear_ui_error().await?;
            Ok(())
        })
        .await
    }

    async fn finish_runtime_status_action(&self) -> anyhow::Result<RuntimeStatusDto> {
        self.clear_ui_error().await?;
        self.get_runtime_status().await
    }

    async fn current_workspace_path(&self) -> anyhow::Result<PathBuf> {
        self.ensure_known_workspaces_loaded().await?;
        let state = self.state.lock().await;
        let workspace_path = state
            .active_workspace_path
            .as_ref()
            .cloned()
            .context("Open a workspace before running git actions.")?;

        let has_running_request = state.conversations.values().any(|conversation| {
            conversation.workspace_path == workspace_path
                && !conversation.active_request_ids.is_empty()
        });
        if has_running_request {
            anyhow::bail!("Wait for the current run to finish before running git actions.");
        }

        Ok(PathBuf::from(workspace_path))
    }
}

fn validate_non_empty_value(value: &str, label: &str) -> anyhow::Result<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        anyhow::bail!("{label} cannot be empty.");
    }

    Ok(trimmed.to_string())
}

fn git_ref_exists(workspace_path: &Path, reference: &str) -> anyhow::Result<bool> {
    let output = Command::new("git")
        .args(["show-ref", "--verify", "--quiet", reference])
        .current_dir(workspace_path)
        .output()
        .with_context(|| "Failed to launch git. Make sure git is installed.")?;

    Ok(output.status.success())
}

fn git_command_succeeds(workspace_path: &Path, args: &[&str]) -> anyhow::Result<bool> {
    let output = Command::new("git")
        .args(args)
        .current_dir(workspace_path)
        .output()
        .with_context(|| "Failed to launch git. Make sure git is installed.")?;

    Ok(output.status.success())
}

fn run_git_stdout(
    workspace_path: &Path,
    args: &[&str],
    description: &str,
) -> anyhow::Result<String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(workspace_path)
        .output()
        .with_context(|| format!("Failed to launch {description}. Make sure git is installed."))?;

    if output.status.success() {
        let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !value.is_empty() {
            return Ok(value);
        }
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if !stderr.is_empty() {
        anyhow::bail!("{stderr}");
    }

    anyhow::bail!("{description} failed.")
}

fn run_git_command(workspace_path: &Path, args: &[&str], description: &str) -> anyhow::Result<()> {
    let output = Command::new("git")
        .args(args)
        .current_dir(workspace_path)
        .output()
        .with_context(|| format!("Failed to launch {description}. Make sure git is installed."))?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if !stderr.is_empty() {
        anyhow::bail!("{stderr}");
    }
    if !stdout.is_empty() {
        anyhow::bail!("{stdout}");
    }

    anyhow::bail!("{description} failed.")
}
