import { Children, Fragment, type ReactNode } from "react";

import { cn } from "../../lib/utils";

const FILENAME_PATTERN =
  /(?<![\w-])((?:~\/)?(?:[\w.-]+\/)*[\w.-]*\.[A-Za-z0-9][A-Za-z0-9._-]*)(?=[:),\].\s]|$)/g;

function FilenameButton({ label }: { label: string }) {
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

function buildTextSegments(text: string, keyPrefix: string): ReactNode[] {
  const segments: ReactNode[] = [];
  let match: RegExpExecArray | null;
  let lastIndex = 0;
  let matchIndex = 0;

  FILENAME_PATTERN.lastIndex = 0;

  while ((match = FILENAME_PATTERN.exec(text)) !== null) {
    const [fullMatch, filename] = match;
    const matchStart = match.index;
    const matchEnd = matchStart + fullMatch.length;

    if (matchStart > lastIndex) {
      segments.push(text.slice(lastIndex, matchStart));
    }

    segments.push(
      <FilenameButton
        key={`${keyPrefix}-file-${matchIndex}`}
        label={filename}
      />,
    );

    lastIndex = matchEnd;
    matchIndex += 1;
  }

  if (lastIndex < text.length) {
    segments.push(text.slice(lastIndex));
  }

  return segments;
}

function InlineTextSegments({
  keyPrefix,
  text,
}: {
  keyPrefix: string;
  text: string;
}) {
  return <>{buildTextSegments(text, keyPrefix)}</>;
}

export function ChatInlineText({
  as: Component = "span",
  className,
  text,
}: {
  as?: "p" | "span";
  className?: string;
  text: string;
}) {
  return (
    <Component className={cn("m-0", className)}>
      <InlineTextSegments text={text} keyPrefix="chat-inline-text" />
    </Component>
  );
}

export function ChatInlineChildren({ children }: { children: ReactNode }) {
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
