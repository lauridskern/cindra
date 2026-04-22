mod actions;
mod conversation;
mod errors;
mod factory;
mod file_diffs;
mod manager;
mod snapshot;
mod state;
mod stream;
mod todos;
mod transforms;
mod workspace;

pub(crate) use conversation::select_empty_draft_conversation_id;
pub(crate) use errors::format_error_chain;
pub(crate) use factory::{
    ForgeRuntime, MISSING_SESSION_MESSAGE, RuntimeFactory, configuration_error_message,
    create_conversation_record, read_config,
};
pub use manager::RuntimeManager;
pub(crate) use snapshot::{build_snapshot, fallback_workspace_state, hydrate_conversation_state};
pub use state::DesktopState;
pub(crate) use state::{
    ConversationSessionState, PendingFileUpdateState, RuntimeState, WorkspaceKind,
    WorkspaceSessionState, shared_runtime_state,
};
pub(crate) use stream::create_message_id;
pub(crate) use todos::{apply_todo_result, map_session_todos};
pub(crate) use transforms::{
    PersistedConversationSummary, derive_conversation_title_from_messages,
    resolved_workspace_display_name, session_messages_from_conversation,
    user_prompt_text_for_display, workspace_name,
};
pub(crate) use workspace::canonicalize_workspace_path;
