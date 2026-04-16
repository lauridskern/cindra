import type { ReactNode } from 'react'
import { vi } from 'vitest'

import type {
  ChatEventEnvelope,
  CloneRepositoryInput,
  ConversationTranscript,
  FollowupResponse,
  FollowupRequest,
  ProjectConversationGroup,
  QuickStartProjectInput,
  RuntimeStatus,
  SendPromptResult,
} from '../services/desktop/contracts'

export interface DesktopClientMock {
  chat: {
    emit: (payload: ChatEventEnvelope) => void
    set: (handler: ((payload: ChatEventEnvelope) => void) | null) => void
  }
  followup: {
    emit: (payload: FollowupRequest) => void
    set: (handler: ((payload: FollowupRequest) => void) | null) => void
  }
  getRuntimeStatus: ReturnType<typeof vi.fn<() => Promise<RuntimeStatus>>>
  pickDirectory: ReturnType<typeof vi.fn<(title?: string) => Promise<string | null>>>
  pickWorkspace: ReturnType<typeof vi.fn<() => Promise<string | null>>>
  openWorkspace: ReturnType<typeof vi.fn<(path: string) => Promise<RuntimeStatus>>>
  listProjects: ReturnType<typeof vi.fn<() => Promise<ProjectConversationGroup[]>>>
  loadConversation: ReturnType<typeof vi.fn<(conversationId: string) => Promise<ConversationTranscript>>>
  cloneRepository: ReturnType<
    typeof vi.fn<(input: CloneRepositoryInput) => Promise<string>>
  >
  quickStartProject: ReturnType<
    typeof vi.fn<(input: QuickStartProjectInput) => Promise<string>>
  >
  sendPrompt: ReturnType<
    typeof vi.fn<
      (input: { prompt: string; conversationId?: string }) => Promise<SendPromptResult>
    >
  >
  respondFollowup: ReturnType<typeof vi.fn<(response: FollowupResponse) => Promise<void>>>
  resetChat: ReturnType<typeof vi.fn<() => Promise<{ conversationId: string }>>>
}

export function createDesktopClientMock(): DesktopClientMock {
  let chatHandler: ((payload: ChatEventEnvelope) => void) | null = null
  let followupHandler: ((payload: FollowupRequest) => void) | null = null

  return {
    chat: {
      emit(payload) {
        chatHandler?.(payload)
      },
      set(handler) {
        chatHandler = handler
      },
    },
    followup: {
      emit(payload) {
        followupHandler?.(payload)
      },
      set(handler) {
        followupHandler = handler
      },
    },
    getRuntimeStatus: vi.fn<() => Promise<RuntimeStatus>>(),
    pickDirectory: vi.fn<(title?: string) => Promise<string | null>>(),
    pickWorkspace: vi.fn<() => Promise<string | null>>(),
    openWorkspace: vi.fn<(path: string) => Promise<RuntimeStatus>>(),
    listProjects: vi.fn<() => Promise<ProjectConversationGroup[]>>(),
    loadConversation: vi.fn<
      (conversationId: string) => Promise<ConversationTranscript>
    >(),
    cloneRepository: vi.fn<(input: CloneRepositoryInput) => Promise<string>>(),
    quickStartProject: vi.fn<(input: QuickStartProjectInput) => Promise<string>>(),
    sendPrompt: vi.fn<
      (input: { prompt: string; conversationId?: string }) => Promise<SendPromptResult>
    >(),
    respondFollowup: vi.fn<(response: FollowupResponse) => Promise<void>>(),
    resetChat: vi.fn<() => Promise<{ conversationId: string }>>(),
  }
}

export function createDesktopClientModule(mock: DesktopClientMock) {
  return {
    __esModule: true,
    getRuntimeStatus: mock.getRuntimeStatus,
    pickDirectory: mock.pickDirectory,
    pickWorkspace: mock.pickWorkspace,
    openWorkspace: mock.openWorkspace,
    listProjects: mock.listProjects,
    loadConversation: mock.loadConversation,
    cloneRepository: mock.cloneRepository,
    quickStartProject: mock.quickStartProject,
    sendPrompt: mock.sendPrompt,
    respondFollowup: mock.respondFollowup,
    resetChat: mock.resetChat,
    listenChatEvents: async (handler: (payload: ChatEventEnvelope) => void) => {
      mock.chat.set(handler)
      return () => mock.chat.set(null)
    },
    listenFollowupRequests: async (
      handler: (payload: FollowupRequest) => void,
    ) => {
      mock.followup.set(handler)
      return () => mock.followup.set(null)
    },
  }
}

export function createLegendListModule() {
  return {
    __esModule: true,
    LegendList: ({
      data,
      renderItem,
      ListEmptyComponent,
    }: {
      data: unknown[]
      renderItem: (props: { item: unknown; index: number }) => ReactNode
      ListEmptyComponent?: ReactNode
    }) => (
      <div data-testid="legend-list">
        {data.length === 0
          ? ListEmptyComponent ?? null
          : data.map((item, index) => (
              <div key={index}>{renderItem({ item, index })}</div>
            ))}
      </div>
    ),
  }
}

export function resetDesktopClientMock(mock: DesktopClientMock) {
  mock.chat.set(null)
  mock.followup.set(null)
  mock.getRuntimeStatus.mockReset()
  mock.pickDirectory.mockReset()
  mock.pickWorkspace.mockReset()
  mock.openWorkspace.mockReset()
  mock.listProjects.mockReset()
  mock.loadConversation.mockReset()
  mock.cloneRepository.mockReset()
  mock.quickStartProject.mockReset()
  mock.sendPrompt.mockReset()
  mock.respondFollowup.mockReset()
  mock.resetChat.mockReset()
}
