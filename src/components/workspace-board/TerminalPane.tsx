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
const INITIAL_RESIZE_OBSERVER_DELAY_MS = 300;
const TERMINAL_STABLE_FRAME_COUNT = 6;
const TERMINAL_STABLE_FRAME_ATTEMPTS = 30;
const FONT_READY_TIMEOUT_MS = 500;

type TerminalStatus =
  | { kind: "connecting"; message: string }
  | { kind: "exited"; message: string }
  | { kind: "error"; message: string }
  | null;

interface TerminalGridSize {
  cols: number;
  rows: number;
}

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
    let delayedResizeObserverId: number | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeFrameId: number | null = null;
    let syncedBackendSize: TerminalGridSize | null = null;

    const syncTerminalSize = async (
      nextSize: TerminalGridSize,
      options?: { syncBackend?: boolean },
    ) => {
      if (terminal == null) {
        return;
      }

      const currentSize = normalizeTerminalSize(terminal.cols, terminal.rows);
      if (
        currentSize.cols !== nextSize.cols ||
        currentSize.rows !== nextSize.rows
      ) {
        terminal.resize(nextSize.cols, nextSize.rows);
      }

      if (!options?.syncBackend || !openedRef.current) {
        return;
      }

      if (
        syncedBackendSize != null &&
        syncedBackendSize.cols === nextSize.cols &&
        syncedBackendSize.rows === nextSize.rows
      ) {
        return;
      }

      syncedBackendSize = nextSize;

      try {
        await desktopClient.resizeTerminal({
          terminalId,
          cols: nextSize.cols,
          rows: nextSize.rows,
        });
      } catch {
        // Ignore best-effort resize failures during mount or teardown races.
      }
    };

    const scheduleObservedResize = () => {
      if (resizeFrameId != null) {
        return;
      }

      resizeFrameId = window.requestAnimationFrame(() => {
        resizeFrameId = null;

        if (disposed || terminal == null) {
          return;
        }

        const nextSize = measureTerminalGridSize(terminal);
        if (nextSize == null) {
          return;
        }

        void syncTerminalSize(nextSize, { syncBackend: true });
      });
    };

    const setup = async () => {
      terminal = new WTerm(container, {
        cols: DEFAULT_COLS,
        rows: DEFAULT_ROWS,
        autoResize: false,
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

      if (disposed) {
        cleanupListeners.forEach((cleanup) => {
          cleanup();
        });
        cleanupListeners = [];
        return;
      }

      const initialSize = await waitForStableTerminalSize(terminal);
      await syncTerminalSize(initialSize);

      const session = await desktopClient.openTerminal({
        terminalId,
        workspacePath: params.workspacePath,
        cols: initialSize.cols,
        rows: initialSize.rows,
      });

      if (disposed) {
        cleanupListeners.forEach((cleanup) => {
          cleanup();
        });
        cleanupListeners = [];
        void desktopClient.closeTerminal({ terminalId });
        return;
      }

      openedRef.current = true;
      setStatus(null);

      const resolvedSize = normalizeTerminalSize(session.cols, session.rows);
      syncedBackendSize = resolvedSize;
      await syncTerminalSize(resolvedSize);

      delayedResizeObserverId = window.setTimeout(() => {
        if (disposed) {
          return;
        }

        resizeObserver = new ResizeObserver(() => {
          scheduleObservedResize();
        });
        resizeObserver.observe(container);
      }, INITIAL_RESIZE_OBSERVER_DELAY_MS);

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

      if (delayedResizeObserverId != null) {
        window.clearTimeout(delayedResizeObserverId);
      }
      if (resizeFrameId != null) {
        window.cancelAnimationFrame(resizeFrameId);
      }
      resizeObserver?.disconnect();

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
  element.style.removeProperty("--term-bg");
  element.style.removeProperty("--term-font-family");
  element.style.removeProperty("--term-font-size");
  element.style.removeProperty("--term-line-height");
  element.style.removeProperty("--term-row-height");
  element.style.removeProperty("border-radius");
  element.style.removeProperty("box-shadow");
  element.style.removeProperty("padding");
}

async function waitForStableTerminalSize(terminal: WTerm) {
  await waitForFontsReady();

  let stableFrames = 0;
  let stableSize = measureTerminalGridSize(terminal);

  for (
    let attempt = 0;
    attempt < TERMINAL_STABLE_FRAME_ATTEMPTS;
    attempt += 1
  ) {
    await nextFrame();
    const measuredSize = measureTerminalGridSize(terminal);
    if (measuredSize == null) {
      continue;
    }

    if (
      stableSize != null &&
      measuredSize.cols === stableSize.cols &&
      measuredSize.rows === stableSize.rows
    ) {
      stableFrames += 1;
      if (stableFrames >= TERMINAL_STABLE_FRAME_COUNT) {
        return measuredSize;
      }
      continue;
    }

    stableSize = measuredSize;
    stableFrames = 0;
  }

  return stableSize ?? normalizeTerminalSize(DEFAULT_COLS, DEFAULT_ROWS);
}

async function waitForFontsReady() {
  const fonts = document.fonts;
  if (fonts == null) {
    return;
  }

  try {
    await Promise.race([
      fonts.ready,
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, FONT_READY_TIMEOUT_MS);
      }),
    ]);
  } catch {
    // Ignore font loading failures and continue with best-effort metrics.
  }
}

function normalizeTerminalSize(cols: number, rows: number) {
  return {
    cols: Math.max(2, Math.floor(cols) || DEFAULT_COLS),
    rows: Math.max(1, Math.floor(rows) || DEFAULT_ROWS),
  };
}

function measureTerminalGridSize(terminal: WTerm): TerminalGridSize | null {
  const element = terminal.element;
  if (element.clientWidth === 0 || element.clientHeight === 0) {
    return null;
  }

  const probeRow = document.createElement("div");
  probeRow.className = "term-row";
  probeRow.style.visibility = "hidden";
  probeRow.style.position = "absolute";

  const probeCell = document.createElement("span");
  probeCell.textContent = "W";
  probeRow.appendChild(probeCell);
  element.appendChild(probeRow);

  const charWidth = probeCell.getBoundingClientRect().width;
  const rowHeight = probeRow.getBoundingClientRect().height;

  probeRow.remove();

  if (charWidth <= 0 || rowHeight <= 0) {
    return null;
  }

  return normalizeTerminalSize(
    Math.floor(element.clientWidth / charWidth),
    Math.floor(element.clientHeight / rowHeight),
  );
}

function nextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}
