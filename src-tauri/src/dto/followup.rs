use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FollowupKind {
    Text,
    Single,
    Multi,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FollowupOptionDto {
    pub id: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FollowupRequestDto {
    pub followup_id: String,
    pub workspace_path: String,
    pub conversation_id: String,
    pub request_id: String,
    pub kind: FollowupKind,
    pub question: String,
    pub options: Option<Vec<FollowupOptionDto>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FollowupResponseDto {
    pub followup_id: String,
    pub cancelled: bool,
    pub text: Option<String>,
    pub selected_option_ids: Option<Vec<String>>,
}
