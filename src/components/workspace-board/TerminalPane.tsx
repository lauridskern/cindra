import { useEffect, useMemo, useRef, useState } from "react";
import type { IDockviewPanelProps } from "dockview-react";
import { WTerm } from "@wterm/dom";
import "@wterm/dom/css";

import { PaneSurface } from "@/components/ui/pane-surface";
import * as desktopClient from "@/services/desktop/client";

import {
  createTerminalSessionId,
  TERMINAL_RESTART_EVENT_NAME,
  type TerminalPaneParams,
} from "./layout";

const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;
const TERMINAL_FONT_SIZE_PX = 13;
const TERMINAL_LINE_HEIGHT = 1.2;
const TERMINAL_ROW_HEIGHT_PX = Math.ceil(
  TERMINAL_FONT_SIZE_PX * TERMINAL_LINE_HEIGHT,
);

type TerminalStatus =
  | { kind: "connecting"; message: string }
  | { kind: "exited"; message: string }
  | { kind: "error"; message: string }
  | null;

export function TerminalPane({
  params,
}: IDockviewPanelProps<TerminalPaneParams>) {
  const isDarkTheme = useIsDarkTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<WTerm | null>(null);
  const openedRef = useRef(false);
  const [restartNonce, setRestartNonce] = useState(0);
  const [status, setStatus] = useState<TerminalStatus>({
    kind: "connecting",
    message: "Starting shell...",
  });
  const terminalId = useMemo(() => {
    return createTerminalSessionId({
      workspacePath: params.workspacePath,
      conversationId: params.conversationId,
    });
  }, [params.conversationId, params.workspacePath]);

  useEffect(() => {
    const handleRestart = (event: Event) => {
      const customEvent = event as CustomEvent<{ terminalId?: string }>;
      if (customEvent.detail?.terminalId !== terminalId) {
        return;
      }

      openedRef.current = false;
      setStatus({
        kind: "connecting",
        message: "Starting shell...",
      });
      setRestartNonce((current) => current + 1);
    };

    window.addEventListener(TERMINAL_RESTART_EVENT_NAME, handleRestart);
    return () => {
      window.removeEventListener(TERMINAL_RESTART_EVENT_NAME, handleRestart);
    };
  }, [terminalId]);

  useEffect(() => {
    const container = containerRef.current;
    if (container == null) {
      return;
    }

    let disposed = false;
    let terminal: WTerm | null = null;
    let cleanupListeners: Array<() => void> = [];

    const syncResize = async () => {
      if (!openedRef.current || terminal == null) {
        return;
      }

      const { cols, rows } = normalizeTerminalSize(terminal.cols, terminal.rows);
      try {
        await desktopClient.resizeTerminal({
          terminalId,
          cols,
          rows,
        });
      } catch {
        // Ignore best-effort resize failures during mount or teardown races.
      }
    };

    const setup = async () => {
      terminal = new WTerm(container, {
        cols: DEFAULT_COLS,
        rows: DEFAULT_ROWS,
        autoResize: true,
        cursorBlink: true,
        onData(data) {
          if (!openedRef.current) {
            return;
          }

          void desktopClient.writeTerminal({
            terminalId,
            data,
          });
        },
        onResize() {
          void syncResize();
        },
      });
      terminalRef.current = terminal;
      applyTerminalAppearance(terminal.element, readIsDarkTheme());
      await terminal.init();

      cleanupListeners = await Promise.all([
        desktopClient.listenTerminalOutput(terminalId, (event) => {
          terminal?.write(event.data);
        }),
        desktopClient.listenTerminalExit(terminalId, (event) => {
          const suffix =
            event.signal != null
              ? `terminated by ${event.signal}`
              : `exited with code ${event.exitCode ?? 0}`;
          setStatus({
            kind: "exited",
            message: `Shell ${suffix}. Close and reopen the pane to start a new session.`,
          });
        }),
        desktopClient.listenTerminalErrors(terminalId, (event) => {
          setStatus({
            kind: "error",
            message: event.message,
          });
        }),
      ]);

      const initialSize = await waitForInitialTerminalSize(terminal);
      const session = await desktopClient.openTerminal({
        terminalId,
        workspacePath: params.workspacePath,
        cols: initialSize.cols,
        rows: initialSize.rows,
      });

      if (disposed) {
        return;
      }

      openedRef.current = true;
      setStatus(null);

      if (
        session.cols !== initialSize.cols ||
        session.rows !== initialSize.rows
      ) {
        terminal.resize(session.cols, session.rows);
      }

      terminal.focus();
    };

    void setup().catch((error: unknown) => {
      if (disposed) {
        return;
      }

      const message =
        error instanceof Error ? error.message : "Failed to start terminal session";
      setStatus({
        kind: "error",
        message,
      });
    });

    return () => {
      disposed = true;
      openedRef.current = false;

      for (const cleanup of cleanupListeners) {
        cleanup();
      }

      void desktopClient.closeTerminal({ terminalId });
      terminal?.destroy();
      terminalRef.current = null;
    };
  }, [params.workspacePath, restartNonce, terminalId]);

  useEffect(() => {
    const element = terminalRef.current?.element;
    if (element == null) {
      return;
    }

    applyTerminalAppearance(element, isDarkTheme);
  }, [isDarkTheme]);

  return (
    <PaneSurface className="terminal-pane-shell relative">
      <div className="relative flex min-h-0 flex-1">
        <div className="h-full min-h-0 w-full min-w-0 px-3 py-2.5">
          <div ref={containerRef} className="h-full min-h-0 w-full min-w-0" />
        </div>
        {status != null ? (
          <div className="pointer-events-none absolute inset-x-4 top-4 rounded-md border border-neutral-200 bg-white/90 px-3 py-2 text-xs text-neutral-700 shadow-lg backdrop-blur dark:border-white/10 dark:bg-black/80 dark:text-neutral-200">
            {status.message}
          </div>
        ) : null}
      </div>
    </PaneSurface>
  );
}

function readIsDarkTheme(): boolean {
  return document.documentElement.classList.contains("dark");
}

function useIsDarkTheme() {
  const [isDarkTheme, setIsDarkTheme] = useState(readIsDarkTheme);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDarkTheme(root.classList.contains("dark"));
    });

    observer.observe(root, {
      attributeFilter: ["class"],
      attributes: true,
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return isDarkTheme;
}

function applyTerminalAppearance(element: HTMLElement, isDarkTheme: boolean) {
  element.classList.remove("theme-light", "theme-solarized-dark");
  element.classList.add(isDarkTheme ? "theme-solarized-dark" : "theme-light");

  element.style.setProperty("--term-bg", "transparent");
  element.style.setProperty(
    "--term-font-family",
    '"Geist Mono", ui-monospace, SFMono-Regular, SF Mono, Menlo, Monaco, Consolas, monospace',
  );
  element.style.setProperty("--term-font-size", `${TERMINAL_FONT_SIZE_PX}px`);
  element.style.setProperty(
    "--term-line-height",
    TERMINAL_LINE_HEIGHT.toString(),
  );
  element.style.setProperty("--term-row-height", `${TERMINAL_ROW_HEIGHT_PX}px`);

  element.style.borderRadius = "0";
  element.style.boxShadow = "none";
  element.style.padding = "0";
}

async function waitForInitialTerminalSize(terminal: WTerm) {
  let stableSize = normalizeTerminalSize(terminal.cols, terminal.rows);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await nextFrame();
    const measuredSize = normalizeTerminalSize(terminal.cols, terminal.rows);
    if (
      measuredSize.cols === stableSize.cols &&
      measuredSize.rows === stableSize.rows
    ) {
      return measuredSize;
    }
    stableSize = measuredSize;
  }

  return stableSize;
}

function normalizeTerminalSize(cols: number, rows: number) {
  return {
    cols: Math.max(2, Math.floor(cols) || DEFAULT_COLS),
    rows: Math.max(1, Math.floor(rows) || DEFAULT_ROWS),
  };
}

function nextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}
