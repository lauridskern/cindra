use std::path::Path;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStatusDto {
    pub workspace_path: Option<String>,
    pub workspace_name: Option<String>,
    pub configured: bool,
    pub configuration_error: Option<String>,
}

impl RuntimeStatusDto {
    pub fn new(
        workspace_path: Option<&Path>,
        configured: bool,
        configuration_error: Option<String>,
    ) -> Self {
        Self {
            workspace_path: workspace_path.map(|path| path.to_string_lossy().into_owned()),
            workspace_name: workspace_path
                .and_then(|path| path.file_name())
                .map(|name| name.to_string_lossy().into_owned()),
            configured,
            configuration_error,
        }
    }
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
