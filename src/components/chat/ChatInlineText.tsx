import { Children, Fragment, type ReactNode } from "react";

import { cn } from "@/utils/cn";
import type {
  ChatInlineChildrenProps,
  ChatInlineTextProps,
  FilenameButtonProps,
  InlineTextSegmentsProps,
} from "./types/chatComponents";
import { getInlineTextSegments } from "./utils/inlineText";

function FilenameButton({ label }: FilenameButtonProps) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
      }}
      className="inline rounded-sm bg-transparent p-0 align-baseline text-sky-500 transition hover:text-sky-600 dark:text-sky-400 dark:hover:text-sky-300"
    >
      {label}
    </button>
  );
}

function InlineTextSegments({
  keyPrefix,
  text,
}: InlineTextSegmentsProps) {
  return (
    <>
      {getInlineTextSegments(text).map((segment, index) =>
        segment.kind === "text" ? (
          <Fragment key={`${keyPrefix}-text-${index}`}>
            {segment.value}
          </Fragment>
        ) : (
          <FilenameButton
            key={`${keyPrefix}-file-${index}`}
            label={segment.value}
          />
        ),
      )}
    </>
  );
}

export function ChatInlineText({
  as: Component = "span",
  className,
  text,
}: ChatInlineTextProps) {
  return (
    <Component className={cn("m-0", className)}>
      <InlineTextSegments text={text} keyPrefix="chat-inline-text" />
    </Component>
  );
}

export function ChatInlineChildren({ children }: ChatInlineChildrenProps) {
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
            <InlineTextSegments text={child} keyPrefix={keyPrefix} />
          </Fragment>,
        ],
      };
    },
    { offset: 0, nodes: [] },
  ).nodes;

  return <>{renderedChildren}</>;
}
