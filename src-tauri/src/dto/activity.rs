use forge_domain::{ToolCallFull, ToolCatalog, ToolResult};
use roxmltree::{Document, Node};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

const TOOL_SUMMARY_LIMIT: usize = 220;
const TRUNCATED_OUTPUT_LABEL: &str = "… output truncated …";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "snake_case")]
#[ts(rename = "FileOperation")]
pub enum FileOperationDto {
    Create,
    Overwrite,
    Replace,
    Remove,
    Undo,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(tag = "kind", rename_all = "snake_case")]
#[ts(rename = "ToolCallDetail")]
pub enum ToolCallDetailDto {
    FileRead {
        path: String,
        #[serde(rename = "startLine")]
        start_line: Option<i32>,
        #[serde(rename = "endLine")]
        end_line: Option<i32>,
    },
    FileUpdate {
        path: String,
        operation: FileOperationDto,
    },
    Shell {
        command: String,
        cwd: Option<String>,
        description: Option<String>,
    },
    Search {
        pattern: String,
        path: Option<String>,
        glob: Option<String>,
        #[serde(rename = "fileType")]
        file_type: Option<String>,
    },
    CodebaseSearch {
        queries: Vec<String>,
    },
    Fetch {
        url: String,
    },
    Followup {
        question: String,
    },
    Plan {
        #[serde(rename = "planName")]
        plan_name: String,
    },
    Skill {
        name: String,
    },
    Task {
        #[serde(rename = "agentId")]
        agent_id: String,
    },
    TodoWrite {
        count: usize,
    },
    TodoRead,
    Unknown {
        name: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename = "OutputPreview")]
pub struct OutputPreviewDto {
    pub content: String,
    pub total_lines: usize,
    pub head_display_lines: Option<String>,
    pub tail_display_lines: Option<String>,
    pub full_output_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(tag = "kind", rename_all = "snake_case")]
#[ts(rename = "ToolResultDetail")]
pub enum ToolResultDetailDto {
    FileDiff {
        path: String,
        patch: String,
    },
    ShellOutput {
        command: String,
        shell: String,
        #[serde(rename = "exitCode")]
        exit_code: Option<i32>,
        description: Option<String>,
        stdout: Option<OutputPreviewDto>,
        stderr: Option<OutputPreviewDto>,
    },
    Text {
        text: String,
    },
}

pub fn map_tool_call_detail(tool_call: &ToolCallFull) -> ToolCallDetailDto {
    match ToolCatalog::try_from(tool_call.clone()) {
        Ok(ToolCatalog::Read(input)) => ToolCallDetailDto::FileRead {
            path: input.file_path,
            start_line: input.start_line,
            end_line: input.end_line,
        },
        Ok(ToolCatalog::Write(input)) => ToolCallDetailDto::FileUpdate {
            path: input.file_path,
            operation: if input.overwrite {
                FileOperationDto::Overwrite
            } else {
                FileOperationDto::Create
            },
        },
        Ok(ToolCatalog::Patch(input)) => ToolCallDetailDto::FileUpdate {
            path: input.file_path,
            operation: FileOperationDto::Replace,
        },
        Ok(ToolCatalog::MultiPatch(input)) => ToolCallDetailDto::FileUpdate {
            path: input.file_path,
            operation: FileOperationDto::Replace,
        },
        Ok(ToolCatalog::Remove(input)) => ToolCallDetailDto::FileUpdate {
            path: input.path,
            operation: FileOperationDto::Remove,
        },
        Ok(ToolCatalog::Undo(input)) => ToolCallDetailDto::FileUpdate {
            path: input.path,
            operation: FileOperationDto::Undo,
        },
        Ok(ToolCatalog::Shell(input)) => ToolCallDetailDto::Shell {
            command: input.command,
            cwd: input.cwd.map(|cwd| cwd.display().to_string()),
            description: input.description,
        },
        Ok(ToolCatalog::FsSearch(input)) => ToolCallDetailDto::Search {
            pattern: input.pattern,
            path: input.path,
            glob: input.glob,
            file_type: input.file_type,
        },
        Ok(ToolCatalog::SemSearch(input)) => ToolCallDetailDto::CodebaseSearch {
            queries: input.queries.into_iter().map(|query| query.query).collect(),
        },
        Ok(ToolCatalog::Fetch(input)) => ToolCallDetailDto::Fetch { url: input.url },
        Ok(ToolCatalog::Followup(input)) => ToolCallDetailDto::Followup {
            question: input.question,
        },
        Ok(ToolCatalog::Plan(input)) => ToolCallDetailDto::Plan {
            plan_name: input.plan_name,
        },
        Ok(ToolCatalog::Skill(input)) => ToolCallDetailDto::Skill { name: input.name },
        Ok(ToolCatalog::Task(input)) => ToolCallDetailDto::Task {
            agent_id: input.agent_id,
        },
        Ok(ToolCatalog::TodoWrite(input)) => ToolCallDetailDto::TodoWrite {
            count: input.todos.len(),
        },
        Ok(ToolCatalog::TodoRead(_)) => ToolCallDetailDto::TodoRead,
        Err(_) => ToolCallDetailDto::Unknown {
            name: tool_call.name.to_string(),
        },
    }
}

pub fn map_tool_result_detail(result: &ToolResult) -> Option<ToolResultDetailDto> {
    let text = result.output.as_str()?.trim();
    if text.is_empty() {
        return None;
    }

    let document = match Document::parse(text) {
        Ok(document) => document,
        Err(_) => {
            return Some(ToolResultDetailDto::Text {
                text: text.to_string(),
            });
        }
    };
    let root = document.root_element();

    if root.tag_name().name() == "tool_call_error" {
        let text = parse_tool_call_error_text(root);
        return if text.is_empty() {
            None
        } else {
            Some(ToolResultDetailDto::Text { text })
        };
    }

    if root.tag_name().name() == "shell_output" {
        return Some(ToolResultDetailDto::ShellOutput {
            command: root.attribute("command").unwrap_or_default().to_string(),
            shell: root.attribute("shell").unwrap_or_default().to_string(),
            exit_code: parse_attr_i32(root, "exit_code"),
            description: root.attribute("description").map(str::to_string),
            stdout: root
                .children()
                .find(|child| child.has_tag_name("stdout"))
                .and_then(parse_output_preview),
            stderr: root
                .children()
                .find(|child| child.has_tag_name("stderr"))
                .and_then(parse_output_preview),
        });
    }

    let plain_text = collect_node_text(root);
    if plain_text.is_empty() {
        None
    } else {
        Some(ToolResultDetailDto::Text { text: plain_text })
    }
}

pub fn summarize_tool_result(result: &ToolResult) -> Option<String> {
    let text = normalize_tool_output_text(result.output.as_str()?)?;

    let summary = if text.chars().count() <= TOOL_SUMMARY_LIMIT {
        text
    } else {
        let truncated = text.chars().take(TOOL_SUMMARY_LIMIT).collect::<String>();
        format!("{truncated}…")
    };

    Some(summary)
}

pub(crate) fn normalize_tool_output_text(text: &str) -> Option<String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return None;
    }

    let document = match Document::parse(trimmed) {
        Ok(document) => document,
        Err(_) => return Some(trimmed.to_string()),
    };
    let root = document.root_element();

    match root.tag_name().name() {
        "shell_output" => {
            let preview = build_shell_output_text(root);
            if preview.is_empty() {
                Some(trimmed.to_string())
            } else {
                Some(preview)
            }
        }
        "tool_call_error" => {
            let error = parse_tool_call_error_text(root);
            if error.is_empty() {
                Some(trimmed.to_string())
            } else {
                Some(error)
            }
        }
        _ => {
            let plain_text = collect_node_text(root);
            if plain_text.is_empty() {
                Some(trimmed.to_string())
            } else {
                Some(plain_text)
            }
        }
    }
}

fn parse_output_preview(node: Node<'_, '_>) -> Option<OutputPreviewDto> {
    let total_lines = parse_attr_usize(node, "total_lines").unwrap_or(0);
    let full_output_path = node.attribute("full_output").map(str::to_string);
    let head = node.children().find(|child| child.has_tag_name("head"));
    let tail = node.children().find(|child| child.has_tag_name("tail"));

    let content = match (head, tail) {
        (Some(head), Some(tail)) => {
            let head_text = collect_preformatted_text(head);
            let tail_text = collect_preformatted_text(tail);
            if head_text.is_empty() && tail_text.is_empty() {
                String::new()
            } else {
                format!("{head_text}\n\n{TRUNCATED_OUTPUT_LABEL}\n\n{tail_text}")
            }
        }
        (Some(head), None) => collect_preformatted_text(head),
        (None, Some(tail)) => collect_preformatted_text(tail),
        (None, None) => collect_preformatted_text(node),
    };

    if content.is_empty() {
        return None;
    }

    Some(OutputPreviewDto {
        content,
        total_lines,
        head_display_lines: head
            .and_then(|child| child.attribute("display_lines"))
            .map(str::to_string),
        tail_display_lines: tail
            .and_then(|child| child.attribute("display_lines"))
            .map(str::to_string),
        full_output_path,
    })
}

fn build_shell_output_text(node: Node<'_, '_>) -> String {
    let command = node.attribute("command").unwrap_or_default().trim();
    let stdout = node
        .children()
        .find(|child| child.has_tag_name("stdout"))
        .and_then(parse_output_preview);
    let stderr = node
        .children()
        .find(|child| child.has_tag_name("stderr"))
        .and_then(parse_output_preview);

    let mut sections = Vec::new();
    if !command.is_empty() {
        sections.push(format!("$ {command}"));
    }
    if let Some(stdout) = stdout.filter(|stdout| !stdout.content.is_empty()) {
        sections.push(stdout.content);
    }
    if let Some(stderr) = stderr.filter(|stderr| !stderr.content.is_empty()) {
        sections.push("[stderr]".to_string());
        sections.push(stderr.content);
    }

    sections.join("\n\n").trim().to_string()
}

fn parse_tool_call_error_text(node: Node<'_, '_>) -> String {
    let cause = node
        .children()
        .find(|child| child.has_tag_name("cause"))
        .map(collect_node_text)
        .filter(|text| !text.is_empty());

    cause.unwrap_or_else(|| collect_node_text(node))
}

fn collect_preformatted_text(node: Node<'_, '_>) -> String {
    node.children()
        .filter(|child| child.is_text())
        .filter_map(|child| child.text())
        .collect::<String>()
}

fn collect_node_text(node: Node<'_, '_>) -> String {
    node.descendants()
        .filter(|child| child.is_text())
        .filter_map(|child| child.text())
        .map(str::trim)
        .filter(|text| !text.trim().is_empty())
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string()
}

fn parse_attr_i32(node: Node<'_, '_>, name: &str) -> Option<i32> {
    node.attribute(name)?.parse().ok()
}

fn parse_attr_usize(node: Node<'_, '_>, name: &str) -> Option<usize> {
    node.attribute(name)?.parse().ok()
}
