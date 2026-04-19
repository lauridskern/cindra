import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { PanelLeftIcon, PenSquare } from "lucide-react";

import { ProjectSidebar } from "../components/ProjectSidebar";
import { WorkspaceBoard } from "../components/workspace-board/WorkspaceBoard";
import { Button } from "../components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "../components/ui/resizable";
import { SidebarProvider, useSidebar } from "../components/ui/sidebar";
import { TooltipProvider } from "../components/ui/tooltip";
import { useConversationSession, useSessionActions } from "../hooks/useSession";
import { SessionProvider } from "./SessionProvider";

const DEFAULT_SIDEBAR_WIDTH = 320;
const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 400;

function useSystemThemeClass() {
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    function syncThemeClass(matches: boolean) {
      document.documentElement.classList.toggle("dark", matches);
    }

    syncThemeClass(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      syncThemeClass(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);
}

function AppSidebarToggle({
  isSidebarVisible,
  onToggleDesktopSidebar,
}: {
  isSidebarVisible: boolean;
  onToggleDesktopSidebar: () => void;
}) {
  const { toggleSidebar } = useSidebar();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isSidebarVisible ? "Hide sidebar" : "Show sidebar"}
      className="absolute left-19 top-1.5 z-20"
      onClick={() => {
        toggleSidebar();
        onToggleDesktopSidebar();
      }}
    >
      <PanelLeftIcon strokeWidth={2} className="size-3.5" />
      <span className="sr-only">
        {isSidebarVisible ? "Hide sidebar" : "Show sidebar"}
      </span>
    </Button>
  );
}

function AppShell() {
  useSystemThemeClass();
  const { hasCurrentWorkspace } = useConversationSession();
  const { startNewChat } = useSessionActions();
  const [isDesktopSidebarVisible, setIsDesktopSidebarVisible] = useState(true);
  const sidebarPanelRef = useRef<PanelImperativeHandle | null>(null);

  useLayoutEffect(() => {
    const panel = sidebarPanelRef.current;
    if (panel == null) {
      return;
    }

    if (isDesktopSidebarVisible) {
      panel.expand();
      return;
    }

    panel.collapse();
  }, [isDesktopSidebarVisible]);

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-screen bg-transparent">
        <main className="app-shell relative flex h-screen w-full overflow-hidden bg-transparent">
          <AppSidebarToggle
            isSidebarVisible={isDesktopSidebarVisible}
            onToggleDesktopSidebar={() => {
              setIsDesktopSidebarVisible((current) => !current);
            }}
          />
          {!isDesktopSidebarVisible ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="New chat"
              className="absolute left-26 top-1.5 z-20 disabled:pointer-events-none disabled:opacity-35"
              onClick={() => {
                void startNewChat();
              }}
              disabled={!hasCurrentWorkspace}
            >
              <PenSquare strokeWidth={2} className="size-3.5" />
              <span className="sr-only">New chat</span>
            </Button>
          ) : null}
          <ResizablePanelGroup orientation="horizontal">
            <ResizablePanel
              id="sidebar-panel"
              panelRef={sidebarPanelRef}
              defaultSize={DEFAULT_SIDEBAR_WIDTH}
              minSize={MIN_SIDEBAR_WIDTH}
              maxSize={MAX_SIDEBAR_WIDTH}
              collapsible
              collapsedSize={0}
              groupResizeBehavior="preserve-pixel-size"
              className="overflow-hidden"
              onResize={(size) => {
                const nextIsVisible = size.inPixels > 0;
                setIsDesktopSidebarVisible((current) =>
                  current === nextIsVisible ? current : nextIsVisible,
                );
              }}
            >
              <ProjectSidebar />
            </ResizablePanel>
            <ResizableHandle
              className={
                isDesktopSidebarVisible
                  ? "bg-transparent after:w-2 hover:after:bg-border/80"
                  : "w-0 bg-transparent after:hidden pointer-events-none"
              }
            />
            <ResizablePanel id="chat-panel">
              <section className="flex h-full min-w-0 flex-1 overflow-hidden">
                <WorkspaceBoard />
              </section>
            </ResizablePanel>
          </ResizablePanelGroup>
        </main>
      </SidebarProvider>
    </TooltipProvider>
  );
}

function App() {
  return (
    <SessionProvider>
      <AppShell />
    </SessionProvider>
  );
}

export default App;
