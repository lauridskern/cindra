use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::dto::{FileOperationDto, SessionMessageDto, ToolCallDetailDto};

use super::{ConversationSessionState, create_message_id};

const GIT_STATUS_RENAME_SEPARATOR: &str = " -> ";

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct ChangedFileSummaryEntry {
    pub(crate) path: String,
    pub(crate) description: String,
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub(crate) struct GitChangeSnapshot {
    paths: BTreeSet<String>,
}

impl GitChangeSnapshot {
    pub(crate) fn capture(workspace_path: &Path) -> Self {
        let paths = git_changed_file_paths(workspace_path).unwrap_or_default();
        Self { paths }
    }

    fn contains(&self, path: &str) -> bool {
        self.paths.contains(path)
    }
}

impl ChangedFileSummaryEntry {
    fn new(path: impl Into<String>, description: impl Into<String>) -> Self {
        Self {
            path: path.into(),
            description: description.into(),
        }
    }
}

impl ConversationSessionState {
    pub(crate) fn append_changed_files_summary(
        &mut self,
        request_id: &str,
        before_snapshot: &GitChangeSnapshot,
    ) {
        let entries = collect_changed_file_summary_entries(self, request_id, before_snapshot);
        if entries.is_empty() {
            return;
        }

        let next_index = self.messages.len();
        self.messages.push(SessionMessageDto::StatusOutput {
            id: create_message_id("changed-files", request_id, next_index),
            request_id: request_id.to_string(),
            text: format_changed_files_summary(&entries),
        });
    }
}

fn collect_changed_file_summary_entries(
    conversation: &ConversationSessionState,
    request_id: &str,
    before_snapshot: &GitChangeSnapshot,
) -> Vec<ChangedFileSummaryEntry> {
    let workspace_path = Path::new(&conversation.workspace_path);
    let touched_files = collect_touched_file_operations(&conversation.messages, request_id);
    let status_entries = git_changed_file_summary_entries(workspace_path).unwrap_or_default();

    if status_entries.is_empty() {
        return touched_files
            .into_iter()
            .filter(|(path, _)| !before_snapshot.contains(path))
            .map(|(path, operation)| {
                ChangedFileSummaryEntry::new(path, file_operation_description(operation))
            })
            .collect();
    }

    let mut entries = BTreeMap::new();
    for status_entry in status_entries {
        if !before_snapshot.contains(&status_entry.path) {
            entries.insert(status_entry.path.clone(), status_entry);
        }
    }

    for (path, operation) in touched_files {
        if let Some(entry) = entries.get_mut(&path) {
            entry.description = file_operation_description(operation).to_string();
        }
    }

    entries.into_values().collect()
}

fn collect_touched_file_operations(
    messages: &[SessionMessageDto],
    request_id: &str,
) -> BTreeMap<String, FileOperationDto> {
    let mut files = BTreeMap::new();

    for message in messages {
        let SessionMessageDto::ToolStart {
            request_id: current_request_id,
            detail: ToolCallDetailDto::FileUpdate { path, operation },
            ..
        } = message
        else {
            continue;
        };

        if current_request_id == request_id {
            files.insert(normalize_summary_path(path), operation.clone());
        }
    }

    files
}

fn git_changed_file_summary_entries(
    workspace_path: &Path,
) -> anyhow::Result<Vec<ChangedFileSummaryEntry>> {
    let output = Command::new("git")
        .args(["status", "--porcelain=v1", "--untracked-files=normal"])
        .current_dir(workspace_path)
        .output()?;

    if !output.status.success() {
        return Ok(Vec::new());
    }

    Ok(String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(parse_git_status_line)
        .collect())
}

fn git_changed_file_paths(workspace_path: &Path) -> anyhow::Result<BTreeSet<String>> {
    Ok(git_changed_file_summary_entries(workspace_path)?
        .into_iter()
        .map(|entry| entry.path)
        .collect())
}

fn parse_git_status_line(line: &str) -> Option<ChangedFileSummaryEntry> {
    let bytes = line.as_bytes();
    if bytes.len() < 4 || bytes[2] != b' ' {
        return None;
    }

    let index_status = bytes[0] as char;
    let worktree_status = bytes[1] as char;
    let raw_path = line.get(3..)?.trim();
    let path = normalize_git_status_path(raw_path);
    if path.is_empty() {
        return None;
    }

    Some(ChangedFileSummaryEntry::new(
        path,
        git_status_description(index_status, worktree_status),
    ))
}

fn normalize_git_status_path(path: &str) -> String {
    let path = path
        .rsplit_once(GIT_STATUS_RENAME_SEPARATOR)
        .map(|(_, renamed_path)| renamed_path)
        .unwrap_or(path);

    normalize_summary_path(&unquote_git_status_path(path.trim()))
}

fn unquote_git_status_path(path: &str) -> String {
    path.strip_prefix('"')
        .and_then(|value| value.strip_suffix('"'))
        .map(unescape_quoted_git_path)
        .unwrap_or_else(|| path.to_string())
}

fn unescape_quoted_git_path(path: &str) -> String {
    let mut output = String::with_capacity(path.len());
    let mut chars = path.chars();

    while let Some(current) = chars.next() {
        if current != '\\' {
            output.push(current);
            continue;
        }

        match chars.next() {
            Some('\\') => output.push('\\'),
            Some('"') => output.push('"'),
            Some('n') => output.push('\n'),
            Some('t') => output.push('\t'),
            Some(next) => output.push(next),
            None => output.push('\\'),
        }
    }

    output
}

fn normalize_summary_path(path: &str) -> String {
    PathBuf::from(path)
        .to_string_lossy()
        .replace('\\', "/")
        .trim_start_matches("./")
        .to_string()
}

fn file_operation_description(operation: FileOperationDto) -> &'static str {
    match operation {
        FileOperationDto::Create => "Created",
        FileOperationDto::Overwrite | FileOperationDto::Replace | FileOperationDto::Undo => {
            "Updated"
        }
        FileOperationDto::Remove => "Deleted",
    }
}

fn git_status_description(index_status: char, worktree_status: char) -> &'static str {
    if index_status == '?' && worktree_status == '?' {
        return "Created";
    }

    if index_status == 'D' || worktree_status == 'D' {
        return "Deleted";
    }

    if index_status == 'A' || worktree_status == 'A' {
        return "Created";
    }

    if index_status == 'R' || worktree_status == 'R' {
        return "Renamed";
    }

    if index_status == 'C' || worktree_status == 'C' {
        return "Copied";
    }

    "Updated"
}

fn format_changed_files_summary(entries: &[ChangedFileSummaryEntry]) -> String {
    let file_label = if entries.len() == 1 { "file" } else { "files" };
    let mut lines = vec![format!("Changed {} {}:", entries.len(), file_label)];
    lines.extend(
        entries
            .iter()
            .map(|entry| format!("- `{}` — {}", entry.path, entry.description)),
    );
    lines.join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_git_status_line_describes_common_statuses() {
        assert_eq!(
            parse_git_status_line(" M src/lib.rs"),
            Some(ChangedFileSummaryEntry::new("src/lib.rs", "Updated")),
        );
        assert_eq!(
            parse_git_status_line("?? src/new.rs"),
            Some(ChangedFileSummaryEntry::new("src/new.rs", "Created")),
        );
        assert_eq!(
            parse_git_status_line(" D src/old.rs"),
            Some(ChangedFileSummaryEntry::new("src/old.rs", "Deleted")),
        );
        assert_eq!(
            parse_git_status_line("R  src/old.rs -> src/new.rs"),
            Some(ChangedFileSummaryEntry::new("src/new.rs", "Renamed")),
        );
    }

    #[test]
    fn collect_changed_file_summary_entries_excludes_preexisting_git_changes() {
        let conversation = ConversationSessionState {
            workspace_path: "/tmp/example".to_string(),
            messages: vec![SessionMessageDto::ToolStart {
                id: "tool-start:request-1:0".to_string(),
                request_id: "request-1".to_string(),
                name: "patch".to_string(),
                call_id: Some("call-1".to_string()),
                detail: ToolCallDetailDto::FileUpdate {
                    path: "src/existing.rs".to_string(),
                    operation: FileOperationDto::Replace,
                },
            }],
            todos: Vec::new(),
            pending_file_updates: Default::default(),
            pending_anonymous_file_updates: Default::default(),
            title: Some("Example".to_string()),
            updated_at: None,
            active_request_ids: vec!["request-1".to_string()],
            is_local_draft: false,
            order: 1,
        };
        let before_snapshot = GitChangeSnapshot {
            paths: BTreeSet::from(["src/existing.rs".to_string()]),
        };

        assert!(
            collect_changed_file_summary_entries(&conversation, "request-1", &before_snapshot)
                .is_empty()
        );
    }

    #[test]
    fn append_changed_files_summary_uses_request_file_operations() {
        let mut conversation = ConversationSessionState {
            workspace_path: "/tmp/example".to_string(),
            messages: vec![SessionMessageDto::ToolStart {
                id: "tool-start:request-1:0".to_string(),
                request_id: "request-1".to_string(),
                name: "patch".to_string(),
                call_id: Some("call-1".to_string()),
                detail: ToolCallDetailDto::FileUpdate {
                    path: "src/main.rs".to_string(),
                    operation: FileOperationDto::Replace,
                },
            }],
            todos: Vec::new(),
            pending_file_updates: Default::default(),
            pending_anonymous_file_updates: Default::default(),
            title: Some("Example".to_string()),
            updated_at: None,
            active_request_ids: vec!["request-1".to_string()],
            is_local_draft: false,
            order: 1,
        };

        conversation.append_changed_files_summary("request-1", &GitChangeSnapshot::default());

        assert_eq!(
            conversation.messages.last(),
            Some(&SessionMessageDto::StatusOutput {
                id: "changed-files:request-1:1".to_string(),
                request_id: "request-1".to_string(),
                text: "Changed 1 file:\n- `src/main.rs` — Updated".to_string(),
            }),
        );
    }

    #[test]
    fn append_changed_files_summary_skips_requests_without_file_updates() {
        let mut conversation = ConversationSessionState {
            workspace_path: "/tmp/example".to_string(),
            messages: vec![SessionMessageDto::Assistant {
                id: "assistant:request-1:0".to_string(),
                request_id: "request-1".to_string(),
                text: "No changes.".to_string(),
            }],
            todos: Vec::new(),
            pending_file_updates: Default::default(),
            pending_anonymous_file_updates: Default::default(),
            title: Some("Example".to_string()),
            updated_at: None,
            active_request_ids: vec!["request-1".to_string()],
            is_local_draft: false,
            order: 1,
        };

        conversation.append_changed_files_summary("request-1", &GitChangeSnapshot::default());

        assert_eq!(conversation.messages.len(), 1);
    }

    #[test]
    fn format_changed_files_summary_uses_markdown_list() {
        let entries = vec![
            ChangedFileSummaryEntry::new("src/a.rs", "Updated"),
            ChangedFileSummaryEntry::new("src/b.rs", "Created"),
        ];

        assert_eq!(
            format_changed_files_summary(&entries),
            "Changed 2 files:\n- `src/a.rs` — Updated\n- `src/b.rs` — Created",
        );
    }
}
