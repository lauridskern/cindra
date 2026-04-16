use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SendPromptInput {
    pub workspace_path: String,
    pub prompt: String,
    pub conversation_id: Option<String>,
}
