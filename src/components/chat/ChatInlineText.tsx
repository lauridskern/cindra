import { Children, Fragment, type ReactNode } from "react";

import { cn } from "@/utils/cn";
import type {
  ChatInlineChildrenProps,
  ChatInlineTextProps,
  FilePathButtonProps,
  InlineTextSegmentsProps,
  UrlButtonProps,
} from "./types/chatComponents";
import {
  openFilePathFromChat,
  openUrlFromChat,
} from "./utils/chatLinks";
import { getInlineTextSegments } from "./utils/inlineText";

const inlineLinkClassName =
  "inline rounded-sm bg-transparent p-0 align-baseline text-sky-500 transition hover:text-sky-600 dark:text-sky-400 dark:hover:text-sky-300";

function UrlButton({ label, url }: UrlButtonProps) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        openUrlFromChat(url);
      }}
      className={inlineLinkClassName}
      title={url}
    >
      {label}
    </button>
  );
}

function FilePathButton({ label, path, workspacePath }: FilePathButtonProps) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        void openFilePathFromChat(workspacePath, path);
      }}
      className={inlineLinkClassName}
      title={workspacePath == null ? path : `Open ${path}`}
    >
      {label}
    </button>
  );
}

function InlineTextSegments({
  keyPrefix,
  text,
  workspacePath,
}: InlineTextSegmentsProps) {
  return (
    <>
      {getInlineTextSegments(text, { workspacePath }).map((segment, index) => {
        if (segment.kind === "text") {
          return (
            <Fragment key={`${keyPrefix}-text-${index}`}>
              {segment.value}
            </Fragment>
          );
        }

        if (segment.kind === "url") {
          return (
            <UrlButton
              key={`${keyPrefix}-url-${index}`}
              label={segment.value}
              url={segment.value}
            />
          );
        }

        return (
          <FilePathButton
            key={`${keyPrefix}-file-${index}`}
            label={segment.value}
            path={segment.path}
            workspacePath={workspacePath}
          />
        );
      })}
    </>
  );
}

export function ChatInlineText({
  as: Component = "span",
  className,
  text,
  workspacePath,
}: ChatInlineTextProps) {
  return (
    <Component className={cn("m-0", className)}>
      <InlineTextSegments
        text={text}
        keyPrefix="chat-inline-text"
        workspacePath={workspacePath}
      />
    </Component>
  );
}

export function ChatInlineChildren({ children, workspacePath }: ChatInlineChildrenProps) {
  const renderedChildren = Children.toArray(children).reduce<{
    offset: number;
    nodes: ReactNode[];
  }>(
    (state, child) => {
      if (typeof child !== "string") {
        return {
          offset: state.offset,
          nodes: [...state.nodes, child],
        };
      }

      const keyPrefix = `inline-text-${state.offset}-${child.length}`;

      return {
        offset: state.offset + child.length,
        nodes: [
          ...state.nodes,
          <Fragment key={keyPrefix}>
            <InlineTextSegments
              text={child}
              keyPrefix={keyPrefix}
              workspacePath={workspacePath}
            />
          </Fragment>,
        ],
      };
    },
    { offset: 0, nodes: [] },
  ).nodes;

  return <>{renderedChildren}</>;
}
