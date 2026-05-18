import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import {
  ArrowLeftIcon,
  LoaderCircle,
  PanelLeftIcon,
  PenSquare,
} from "lucide-react";

import { NewChatTrigger } from "../components/NewChatTrigger";
import { ConfigSettingsPane } from "../components/config-settings/ConfigSettingsPane";
import { ProvidersSettingsPane } from "../components/providers-settings/ProvidersSettingsPane";
import { ProjectSidebar } from "../components/ProjectSidebar";
import { PaneSurface } from "../components/ui/PaneSurface";
import { WorkspaceBoard } from "../components/workspace-board/WorkspaceBoard";
import { Button } from "../components/ui/Button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "../components/ui/Resizable";
import { SidebarProvider, useSidebar } from "../components/ui/Sidebar";
import { TooltipProvider } from "../components/ui/Tooltip";
import { useSystemThemeClass } from "../hooks/useSystemThemeClass";
import { useSessionStore } from "../hooks/useSession";
import { SessionProvider } from "./SessionProvider";
import { SettingsNavigationProvider } from "./settingsNavigation";
import {
  DEFAULT_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
} from "./constants/layout";
import type {
  AppSidebarControlProps,
  SettingsSection,
} from "./types/app";

function AppSidebarControl({
  isSidebarVisible,
  isSettingsViewOpen,
  onExitSettings,
  onToggleDesktopSidebar,
}: AppSidebarControlProps) {
  const { toggleSidebar } = useSidebar();

  if (isSettingsViewOpen) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label="Back"
        className="absolute left-19 top-1.5 z-20"
        onClick={onExitSettings}
      >
        <ArrowLeftIcon strokeWidth={2} className="size-3.5" />
        <span className="sr-only">Back</span>
      </Button>
    );
  }

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
  const isSessionBootstrapped = useSessionStore(
    (state) => state.isBootstrapped,
  );
  const [isDesktopSidebarVisible, setIsDesktopSidebarVisible] = useState(true);
  const [isSettingsViewOpen, setIsSettingsViewOpen] = useState(false);
  const [selectedSettingsSection, setSelectedSettingsSection] =
    useState<SettingsSection>("general");
  const sidebarPanelRef = useRef<PanelImperativeHandle | null>(null);
  const openProvidersSettings = useCallback(() => {
    setIsDesktopSidebarVisible(true);
    setSelectedSettingsSection("providers");
    setIsSettingsViewOpen(true);
  }, []);
  const openConfigSettings = useCallback(() => {
    setIsDesktopSidebarVisible(true);
    setSelectedSettingsSection("config");
    setIsSettingsViewOpen(true);
  }, []);
  const settingsNavigation = useMemo(
    () => ({
      openProviderSettings: openProvidersSettings,
      openConfigSettings,
    }),
    [openConfigSettings, openProvidersSettings],
  );

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

  if (!isSessionBootstrapped) {
    return (
      <main className="app-shell relative flex h-screen w-full items-center justify-center overflow-hidden bg-transparent">
        <LoaderCircle
          aria-hidden="true"
          className="size-5 animate-spin text-muted-foreground/70"
          strokeWidth={2}
        />
      </main>
    );
  }

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-screen bg-transparent">
        <main className="app-shell relative flex h-screen w-full overflow-hidden bg-transparent">
          <AppSidebarControl
            isSidebarVisible={isDesktopSidebarVisible}
            isSettingsViewOpen={isSettingsViewOpen}
            onExitSettings={() => {
              setIsSettingsViewOpen(false);
            }}
            onToggleDesktopSidebar={() => {
              setIsDesktopSidebarVisible((current) => {
                const nextIsVisible = !current;
                if (!nextIsVisible) {
                  setIsSettingsViewOpen(false);
                }
                return nextIsVisible;
              });
            }}
          />
          {!isDesktopSidebarVisible && !isSettingsViewOpen ? (
            <NewChatTrigger>
              {({ isBusy, openNewChat }) => (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="New chat"
                  className="absolute left-26 top-1.5 z-20"
                  disabled={isBusy}
                  onClick={openNewChat}
                >
                  <PenSquare strokeWidth={2} className="size-3.5" />
                  <span className="sr-only">New chat</span>
                </Button>
              )}
            </NewChatTrigger>
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
                if (!nextIsVisible) {
                  setIsSettingsViewOpen(false);
                }
                setIsDesktopSidebarVisible((current) =>
                  current === nextIsVisible ? current : nextIsVisible,
                );
              }}
            >
              <ProjectSidebar
                isSettingsViewOpen={isSettingsViewOpen}
                selectedSettingsSection={selectedSettingsSection}
                onOpenSettings={() => {
                  setIsDesktopSidebarVisible(true);
                  setIsSettingsViewOpen(true);
                }}
                onSelectSettingsSection={setSelectedSettingsSection}
              />
            </ResizablePanel>
            <ResizableHandle
              className={
                isDesktopSidebarVisible && !isSettingsViewOpen
                  ? "bg-transparent after:w-2 hover:after:bg-border/80"
                  : "w-0 bg-transparent after:hidden pointer-events-none"
              }
            />
            <ResizablePanel id="chat-panel">
              <section className="flex h-full min-w-0 flex-1 overflow-hidden">
                {isSettingsViewOpen ? (
                  selectedSettingsSection === "providers" ? (
                    <ProvidersSettingsPane />
                  ) : selectedSettingsSection === "config" ? (
                    <ConfigSettingsPane />
                  ) : (
                    <PaneSurface
                      className="flex-1"
                      aria-label="Settings content"
                    />
                  )
                ) : (
                  <SettingsNavigationProvider value={settingsNavigation}>
                    <WorkspaceBoard />
                  </SettingsNavigationProvider>
                )}
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
