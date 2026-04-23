import type { ConversationPanelAlertsProps } from "./types/conversationHeader";

export function ConversationPanelAlerts({
  activeWorkspaceConfigurationError,
  activeWorkspaceConfigured,
  uiError,
}: ConversationPanelAlertsProps) {
  return (
    <>
      {uiError ? (
        <div
          className="mx-6 mt-2.5 text-sm leading-6 text-red-700 dark:text-red-400"
          role="alert"
        >
          {uiError}
        </div>
      ) : null}

      {activeWorkspaceConfigured === false ? (
        <div
          className="mx-6 mt-2.5 text-sm leading-6 text-amber-700 dark:text-amber-400"
          role="alert"
        >
          {activeWorkspaceConfigurationError ??
            "No session is configured. Configure the terminal session first."}
        </div>
      ) : null}
    </>
  );
}
