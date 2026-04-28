mod activity;
mod chat;
mod followup;
mod runtime;
mod session;
mod terminal;

pub use activity::{FileOperationDto, OutputPreviewDto, ToolCallDetailDto, ToolResultDetailDto};
pub(crate) use activity::{map_tool_call_detail, map_tool_result_detail, summarize_tool_result};
pub use chat::{ChatEventDto, ChatEventKind, StatusCategoryDto, map_chat_response};
pub use followup::{FollowupKind, FollowupOptionDto, FollowupRequestDto, FollowupResponseDto};
pub use runtime::{
    CheckoutGitBranchInput, CloneRepositoryInput, CommitGitChangesInput, CompleteProviderAuthInput,
    CreateGitBranchInput, CreateSavedWorkspaceInput, PromptModelOptionDto, PromptSettingsDto,
    ProviderAuthMethodDto, ProviderAuthMethodKindDto, ProviderAuthSessionDto,
    ProviderAuthSessionKindDto, ProviderOAuthCallbackDto, ProviderSummaryDto, ProviderUrlParamDto,
    ProviderUrlParamValueDto, QuickStartProjectInput, QuickStartVisibility, RemoveProviderInput,
    RuntimeStatusDto, SaveConversationLayoutInput, SendPromptInput, StartProviderAuthInput,
    UpdatePromptSettingsInput, UpdateSavedWorkspaceLayoutInput,
};
pub use session::{
    ChatBindingDto, ConversationSessionSummaryDto, ConversationViewSnapshotDto,
    SavedWorkspaceDetailDto, SavedWorkspaceSummaryDto, SessionMessageDto, SessionSnapshotDto,
    SessionTodoDto, SessionTodoStatusDto, WorkspaceKindDto, WorkspaceSessionDto,
};
pub use terminal::{
    TerminalCloseInput, TerminalErrorEventDto, TerminalExitEventDto, TerminalOpenInput,
    TerminalOutputEventDto, TerminalResizeInput, TerminalSessionDto, TerminalWriteInput,
};
