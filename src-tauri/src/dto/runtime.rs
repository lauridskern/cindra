use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "camelCase")]
pub struct SendPromptInput {
    pub workspace_path: String,
    pub prompt: String,
    pub conversation_id: Option<String>,
}
