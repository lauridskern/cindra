import { ConversationPanel } from '../components/ConversationPanel'
import { ProjectSidebar } from '../components/ProjectSidebar'
import { handleWindowDragStart } from '../utils/window'
import { SessionProvider } from './SessionProvider'

function AppShell() {
  return (
    <main className="app-shell relative h-screen overflow-hidden bg-transparent">
      <div
        className="absolute inset-x-0 left-20 top-0 z-10 h-10 cursor-grab select-none active:cursor-grabbing"
        onMouseDown={handleWindowDragStart}
      />

      <section className="flex h-screen gap-2 overflow-hidden p-2 max-md:flex-col">
        <ProjectSidebar />
        <ConversationPanel />
      </section>
    </main>
  )
}

function App() {
  return (
    <SessionProvider>
      <AppShell />
    </SessionProvider>
  )
}

export default App
