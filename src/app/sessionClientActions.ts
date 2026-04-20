import * as desktopClient from "../services/desktop/client";
import type { RuntimeStatus } from "../services/desktop/contracts";

import { sessionStore } from "./sessionStore";

export async function runWorkspaceRuntimeStatusAction(
  workspacePath: string,
  action: () => Promise<RuntimeStatus>,
) {
  try {
    const runtimeStatus = await action();
    sessionStore.getState().setWorkspaceRuntimeStatus(workspacePath, runtimeStatus);
    return runtimeStatus;
  } catch {
    return null;
  }
}

export async function openWorkspaceInTarget(
  workspacePath: string,
  targetId: string,
) {
  try {
    await desktopClient.openInTarget(workspacePath, targetId);
    return true;
  } catch {
    return false;
  }
}

export async function submitFollowupResponse(input: {
  cancelled: boolean;
  followupId: string;
  text?: string;
  selectedOptionIds?: string[];
}) {
  try {
    const snapshot = await desktopClient.respondFollowup({
      cancelled: input.cancelled,
      followupId: input.followupId,
      selectedOptionIds: input.selectedOptionIds ?? null,
      text: input.text ?? null,
    });
    sessionStore.getState().applySessionSnapshot(snapshot);
    return snapshot;
  } catch {
    return null;
  }
}

export async function updateWorkspacePromptSettings(
  workspacePath: string,
  input: {
    providerId: string;
    modelId: string;
    reasoningEffort?: string | null;
  },
) {
  try {
    const promptSettings = await desktopClient.updatePromptSettings({
      modelId: input.modelId,
      providerId: input.providerId,
      reasoningEffort: input.reasoningEffort ?? null,
      workspacePath,
    });
    sessionStore.getState().setWorkspacePromptSettings(workspacePath, promptSettings);
    return promptSettings;
  } catch {
    return null;
  }
}
