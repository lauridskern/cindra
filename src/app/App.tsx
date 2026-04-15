import { Provider } from 'jotai'

import { ConversationPanelContainer } from '../features/chat/containers/ConversationPanelContainer'
import { FollowupDialogContainer } from '../features/followups/containers/FollowupDialogContainer'
import { ProjectSidebarContainer } from '../features/projects/containers/ProjectSidebarContainer'
import { handleWindowDragStart } from '../lib/window'
import { useSessionBootstrap } from '../state/session/useSessionBootstrap'

function AppShell() {
  useSessionBootstrap()

  return (
    <main className="app-shell relative h-screen overflow-hidden bg-transparent">
      <div
        className="absolute inset-x-0 left-[84px] top-0 z-10 h-[42px] cursor-grab select-none active:cursor-grabbing"
        onMouseDown={handleWindowDragStart}
      />

      <section className="grid h-screen grid-cols-[15rem_minmax(0,1fr)] gap-2 overflow-hidden p-2 max-[860px]:grid-cols-1 max-[860px]:grid-rows-[minmax(240px,auto)_minmax(0,1fr)]">
        <ProjectSidebarContainer />
        <ConversationPanelContainer />
      </section>

      <FollowupDialogContainer />
    </main>
  )
}

function App() {
  return (
    <Provider>
      <AppShell />
    </Provider>
  )
}

export default App
