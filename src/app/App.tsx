import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { PanelLeftIcon, PenSquare } from "lucide-react";

import { ConversationPanel } from "../components/ConversationPanel";
import { ProjectSidebar } from "../components/ProjectSidebar";
import { Button } from "../components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "../components/ui/resizable";
import { SidebarProvider, useSidebar } from "../components/ui/sidebar";
import { TooltipProvider } from "../components/ui/tooltip";
import { useIsMobile } from "../hooks/use-mobile";
import { useConversationSession, useSessionActions } from "../hooks/useSession";
import { handleWindowDragStart } from "../utils/window";
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

interface AppSidebarToggleProps {
  isMobile: boolean;
  isSidebarVisible: boolean;
  onToggleDesktopSidebar: () => void;
}

function AppSidebarToggle({
  isMobile,
  isSidebarVisible,
  onToggleDesktopSidebar,
}: AppSidebarToggleProps) {
  const { toggleSidebar } = useSidebar();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={
        isMobile
          ? "Toggle sidebar"
          : isSidebarVisible
            ? "Hide sidebar"
            : "Show sidebar"
      }
      className="absolute left-19 top-1.5 z-20 text-neutral-800 hover:text-white dark:text-neutral-500 dark:hover:text-white"
      onClick={() => {
        if (isMobile) {
          toggleSidebar();
          return;
        }

        onToggleDesktopSidebar();
      }}
    >
      <PanelLeftIcon strokeWidth={2.5} className="size-3.5" />
      <span className="sr-only">
        {isMobile
          ? "Toggle sidebar"
          : isSidebarVisible
            ? "Hide sidebar"
            : "Show sidebar"}
      </span>
    </Button>
  );
}

function AppShell() {
  useSystemThemeClass();
  const isMobile = useIsMobile();
  const { hasCurrentWorkspace } = useConversationSession();
  const { startNewChat } = useSessionActions();
  const [isDesktopSidebarVisible, setIsDesktopSidebarVisible] = useState(true);
  const sidebarPanelRef = useRef<PanelImperativeHandle | null>(null);

  useLayoutEffect(() => {
    if (isMobile) {
      return;
    }

    const panel = sidebarPanelRef.current;
    if (panel == null) {
      return;
    }

    if (isDesktopSidebarVisible) {
      panel.expand();
      return;
    }

    panel.collapse();
  }, [isDesktopSidebarVisible, isMobile]);

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-screen bg-transparent">
        <main className="app-shell relative flex h-screen w-full overflow-hidden bg-transparent">
          <AppSidebarToggle
            isMobile={isMobile}
            isSidebarVisible={isDesktopSidebarVisible}
            onToggleDesktopSidebar={() => {
              setIsDesktopSidebarVisible((current) => !current);
            }}
          />
          {!isMobile && !isDesktopSidebarVisible ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="New chat"
              className="absolute left-26 top-1.5 z-20 text-neutral-800 hover:text-white disabled:pointer-events-none disabled:opacity-35 dark:text-neutral-500 dark:hover:text-white"
              onClick={() => {
                void startNewChat();
              }}
              disabled={!hasCurrentWorkspace}
            >
              <PenSquare strokeWidth={2.5} className="size-3.5" />
              <span className="sr-only">New chat</span>
            </Button>
          ) : null}

          <div
            className="absolute inset-x-0 left-20 top-0 z-10 h-10 cursor-grab select-none active:cursor-grabbing"
            onMouseDown={handleWindowDragStart}
          />

          {isMobile ? (
            <>
              <ProjectSidebar />
              <section className="flex min-w-0 flex-1 overflow-hidden max-md:w-full">
                <ConversationPanel />
              </section>
            </>
          ) : (
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
                  <ConversationPanel
                    reserveTitlebarInset={!isDesktopSidebarVisible}
                  />
                </section>
              </ResizablePanel>
            </ResizablePanelGroup>
          )}
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
