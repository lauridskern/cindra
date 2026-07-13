use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::dto::{FileOperationDto, SessionMessageDto, ToolCallDetailDto};

use super::{ConversationSessionState, create_message_id};

const GIT_STATUS_RENAME_SEPARATOR: &str = " -> ";
type FileDiffStats = (Option<usize>, Option<usize>);

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct ChangedFileSummaryEntry {
    pub(crate) path: String,
    created: bool,
    pub(crate) additions: Option<usize>,
    pub(crate) deletions: Option<usize>,
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
    fn new(path: impl Into<String>, created: bool) -> Self {
        Self {
            path: path.into(),
            created,
            additions: None,
            deletions: None,
        }
    }

    fn stats(mut self, additions: Option<usize>, deletions: Option<usize>) -> Self {
        self.additions = additions;
        self.deletions = deletions;
        self
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
    let diff_stats = git_diff_stats(workspace_path).unwrap_or_default();
    let status_entries = match git_changed_file_summary_entries(workspace_path) {
        Ok(entries) if entries.is_empty() => return Vec::new(),
        Ok(entries) => entries,
        Err(_) => {
            return touched_files
                .into_iter()
                .filter(|(path, _)| before_snapshot.contains(path) == false)
                .map(|(path, operation)| {
                    let created = file_operation_creates(operation);
                    let (additions, deletions) =
                        stats_for_path(workspace_path, &diff_stats, &path, created);
                    ChangedFileSummaryEntry::new(path, created).stats(additions, deletions)
                })
                .collect();
        }
    };

    let mut entries = BTreeMap::new();
    for status_entry in status_entries {
        if before_snapshot.contains(&status_entry.path) == false {
            entries.insert(status_entry.path.clone(), status_entry);
        }
    }

    for (path, operation) in touched_files {
        if let Some(entry) = entries.get_mut(&path) {
            entry.created = file_operation_creates(operation);
        }
    }

    for entry in entries.values_mut() {
        let (additions, deletions) =
            stats_for_path(workspace_path, &diff_stats, &entry.path, entry.created);
        entry.additions = additions;
        entry.deletions = deletions;
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

    if output.status.success() == false {
        anyhow::bail!("git status failed");
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

fn git_diff_stats(workspace_path: &Path) -> anyhow::Result<BTreeMap<String, FileDiffStats>> {
    let output = Command::new("git")
        .args(["diff", "--numstat", "HEAD"])
        .current_dir(workspace_path)
        .output()?;

    if output.status.success() == false {
        return Ok(BTreeMap::new());
    }

    Ok(String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(parse_git_numstat_line)
        .collect())
}

fn parse_git_numstat_line(line: &str) -> Option<(String, FileDiffStats)> {
    let mut parts = line.split('\t');
    let additions = parse_git_numstat_count(parts.next()?)?;
    let deletions = parse_git_numstat_count(parts.next()?)?;
    let path = parts.collect::<Vec<_>>().join("\t");
    let path = normalize_summary_path(&path);
    if path.is_empty() {
        return None;
    }

    Some((path, (additions, deletions)))
}

fn parse_git_numstat_count(value: &str) -> Option<Option<usize>> {
    let trimmed = value.trim();
    if trimmed == "-" {
        return Some(None);
    }

    match trimmed.parse::<usize>() {
        Ok(value) => Some(Some(value)),
        Err(_) => None,
    }
}

fn stats_for_path(
    workspace_path: &Path,
    diff_stats: &BTreeMap<String, FileDiffStats>,
    path: &str,
    created: bool,
) -> FileDiffStats {
    diff_stats
        .get(path)
        .copied()
        .unwrap_or_else(|| fallback_file_stats(workspace_path, path, created))
}

fn fallback_file_stats(workspace_path: &Path, path: &str, created: bool) -> FileDiffStats {
    if created == false {
        return (Some(0), Some(0));
    }

    let resolved_path = workspace_path.join(path);
    let additions = match std::fs::read_to_string(resolved_path) {
        Ok(text) => text.lines().count(),
        Err(_) => 0,
    };
    (Some(additions), Some(0))
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
        git_status_is_created(index_status, worktree_status),
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

fn file_operation_creates(operation: FileOperationDto) -> bool {
    operation == FileOperationDto::Create
}

fn git_status_is_created(index_status: char, worktree_status: char) -> bool {
    if index_status == '?' && worktree_status == '?' {
        return true;
    }

    if index_status == 'A' || worktree_status == 'A' {
        return true;
    }

    false
}

fn format_changed_files_summary(entries: &[ChangedFileSummaryEntry]) -> String {
    let file_label = if entries.len() == 1 { "file" } else { "files" };
    let mut lines = vec![format!("Changed {} {}:", entries.len(), file_label)];
    lines.extend(entries.iter().map(|entry| {
        format!(
            "- `{}` {}",
            entry.path,
            format_file_stats(entry.additions, entry.deletions)
        )
    }));
    lines.join("\n")
}

fn format_file_stats(additions: Option<usize>, deletions: Option<usize>) -> String {
    let additions = additions
        .map(|value| format!("+{value}"))
        .unwrap_or_else(|| "+-".to_string());
    let deletions = deletions
        .map(|value| format!("-{value}"))
        .unwrap_or_else(|| "--".to_string());
    format!("{additions} {deletions}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temporary_test_directory(name: &str) -> PathBuf {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock before unix epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "agent-ui-{name}-{}-{timestamp}",
            std::process::id()
        ));
        fs::create_dir_all(&path).expect("create temporary test directory");
        path
    }

    fn example_conversation(
        workspace_path: impl Into<String>,
        messages: Vec<SessionMessageDto>,
    ) -> ConversationSessionState {
        ConversationSessionState {
            workspace_path: workspace_path.into(),
            messages,
            todos: Vec::new(),
            pending_file_updates: Default::default(),
            pending_anonymous_file_updates: Default::default(),
            title: Some("Example".to_string()),
            updated_at: None,
            active_request_ids: vec!["request-1".to_string()],
            is_local_draft: false,
            order: 1,
        }
    }

    fn example_file_update_message(path: &str) -> SessionMessageDto {
        SessionMessageDto::ToolStart {
            id: "tool-start:request-1:0".to_string(),
            request_id: "request-1".to_string(),
            name: "patch".to_string(),
            call_id: Some("call-1".to_string()),
            detail: ToolCallDetailDto::FileUpdate {
                path: path.to_string(),
                operation: FileOperationDto::Replace,
            },
        }
    }

    #[test]
    fn parse_git_status_line_describes_common_statuses() {
        assert_eq!(
            parse_git_status_line(" M src/lib.rs"),
            Some(ChangedFileSummaryEntry::new("src/lib.rs", false)),
        );
        assert_eq!(
            parse_git_status_line("?? src/new.rs"),
            Some(ChangedFileSummaryEntry::new("src/new.rs", true)),
        );
        assert_eq!(
            parse_git_status_line(" D src/old.rs"),
            Some(ChangedFileSummaryEntry::new("src/old.rs", false)),
        );
        assert_eq!(
            parse_git_status_line("R  src/old.rs -> src/new.rs"),
            Some(ChangedFileSummaryEntry::new("src/new.rs", false)),
        );
    }

    #[test]
    fn collect_changed_file_summary_entries_excludes_preexisting_git_changes() {
        let conversation = example_conversation(
            "/tmp/example",
            vec![example_file_update_message("src/existing.rs")],
        );
        let before_snapshot = GitChangeSnapshot {
            paths: BTreeSet::from(["src/existing.rs".to_string()]),
        };

        assert!(
            collect_changed_file_summary_entries(&conversation, "request-1", &before_snapshot)
                .is_empty()
        );
    }

    #[test]
    fn collect_changed_file_summary_entries_skips_clean_git_status() {
        let workspace_path = temporary_test_directory("changed-files-clean");
        Command::new("git")
            .arg("init")
            .current_dir(&workspace_path)
            .output()
            .expect("initialize git repository");
        let conversation = example_conversation(
            workspace_path.to_string_lossy(),
            vec![example_file_update_message("src/main.rs")],
        );

        assert!(
            collect_changed_file_summary_entries(
                &conversation,
                "request-1",
                &GitChangeSnapshot::default(),
            )
            .is_empty()
        );

        fs::remove_dir_all(workspace_path).expect("remove temporary test directory");
    }

    #[test]
    fn append_changed_files_summary_uses_request_file_operations() {
        let mut conversation = example_conversation(
            "/tmp/example",
            vec![example_file_update_message("src/main.rs")],
        );

        conversation.append_changed_files_summary("request-1", &GitChangeSnapshot::default());

        assert_eq!(
            conversation.messages.last(),
            Some(&SessionMessageDto::StatusOutput {
                id: "changed-files:request-1:1".to_string(),
                request_id: "request-1".to_string(),
                text: "Changed 1 file:\n- `src/main.rs` +0 -0".to_string(),
            }),
        );
    }

    #[test]
    fn append_changed_files_summary_skips_requests_without_file_updates() {
        let mut conversation = example_conversation(
            "/tmp/example",
            vec![SessionMessageDto::Assistant {
                id: "assistant:request-1:0".to_string(),
                request_id: "request-1".to_string(),
                text: "No changes.".to_string(),
            }],
        );

        conversation.append_changed_files_summary("request-1", &GitChangeSnapshot::default());

        assert_eq!(conversation.messages.len(), 1);
    }

    #[test]
    fn format_changed_files_summary_uses_markdown_list() {
        let entries = vec![
            ChangedFileSummaryEntry::new("src/a.rs", false).stats(Some(8), Some(2)),
            ChangedFileSummaryEntry::new("src/b.rs", true).stats(Some(12), Some(0)),
        ];

        assert_eq!(
            format_changed_files_summary(&entries),
            "Changed 2 files:\n- `src/a.rs` +8 -2\n- `src/b.rs` +12 -0",
        );
    }

    #[test]
    fn parse_git_numstat_line_handles_text_and_binary_stats() {
        assert_eq!(
            parse_git_numstat_line("82\t12\tsrc/app.rs"),
            Some(("src/app.rs".to_string(), (Some(82), Some(12)))),
        );
        assert_eq!(
            parse_git_numstat_line("-\t-\tsrc/image.png"),
            Some(("src/image.png".to_string(), (None, None))),
        );
    }
}
