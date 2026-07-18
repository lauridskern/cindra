import { CheckIcon, CopyIcon } from "lucide-react";
import { Children, isValidElement, useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/utils/cn";
import { CHAT_BODY_TEXT_CLASS } from "./constants/chatStyles";
import { ChatInlineChildren, openFilePathFromChat, openUrlFromChat } from "./ChatInlineText";
import {
  isExternalHttpUrl,
  resolveChatFilePathTarget,
  rewriteChatFileUriHref,
} from "./utils/chatLinks";
import type { ChatMarkdownProps } from "./types/chatComponents";

const headingClassNames = {
  h1: cn("m-0 text-base/7 font-semibold text-current", CHAT_BODY_TEXT_CLASS),
  h2: cn("m-0 text-sm/6 font-semibold text-current", CHAT_BODY_TEXT_CLASS),
  h3: cn("m-0 text-sm/6 font-medium text-current", CHAT_BODY_TEXT_CLASS),
} as const;
const markdownRootClassName =
  "grid min-w-0 max-w-full gap-2 break-words select-text [&_blockquote]:m-0 [&_blockquote]:border-l-2 [&_blockquote]:border-neutral-300 [&_blockquote]:pl-3 [&_blockquote]:text-neutral-600 dark:[&_blockquote]:border-neutral-700 dark:[&_blockquote]:text-neutral-400 [&_code]:rounded-md [&_code]:bg-neutral-200/60 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_code]:text-neutral-900 dark:[&_code]:bg-neutral-800/60 dark:[&_code]:text-neutral-100 [&_del]:text-neutral-500 [&_em]:italic [&_hr]:border-black/10 dark:[&_hr]:border-white/10 [&_li]:m-0 [&_li>p]:m-0 [&_ol]:m-0 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:m-0 [&_p]:whitespace-pre-wrap [&_pre]:m-0 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:overflow-y-hidden [&_pre]:whitespace-pre [&_pre]:break-normal [&_pre]:p-3 [&_pre_code]:inline-block [&_pre_code]:min-w-full [&_pre_code]:w-max [&_pre_code]:align-top [&_pre_code]:whitespace-pre [&_pre_code]:rounded-none [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_ul]:m-0 [&_ul]:list-disc [&_ul]:pl-5";
const codeBlockClassName =
  "group/code relative max-w-full overflow-hidden rounded-xl border border-black/10 bg-neutral-100/70 dark:border-white/10 dark:bg-neutral-900/70";
const codeBlockHeaderClassName =
  "flex items-center justify-between border-b border-black/10 bg-black/5 px-3 py-1.5 text-[11px] font-medium text-neutral-500 dark:border-white/10 dark:bg-white/5 dark:text-neutral-400";
const codeLanguageClassName = "font-mono uppercase tracking-wide";
const codeLanguagePattern = /(?:^|\s)language-([A-Za-z0-9_+-]+)/u;

function nodeToPlainText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map((child) => nodeToPlainText(child)).join("");
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return nodeToPlainText(node.props.children);
  }

  return "";
}

interface CodeBlockDetails {
  code: string;
  language: string | null;
}

function extractCodeBlock(children: ReactNode): CodeBlockDetails | null {
  const childNodes = Children.toArray(children);
  if (childNodes.length !== 1) {
    return null;
  }

  const onlyChild = childNodes[0];
  if (
    !isValidElement<{ children?: ReactNode; className?: string }>(onlyChild) ||
    onlyChild.type !== "code"
  ) {
    return null;
  }

  const className = onlyChild.props.className ?? "";
  return {
    code: nodeToPlainText(onlyChild.props.children),
    language: className.match(codeLanguagePattern)?.[1] ?? null,
  };
}

function chatMarkdownUrlTransform(url: string): string {
  return rewriteChatFileUriHref(url) ?? defaultUrlTransform(url);
}

function handleLinkClick(
  event: MouseEvent<HTMLAnchorElement>,
  href: string,
  workspacePath: string | null | undefined,
) {
  if (isExternalHttpUrl(href)) {
    event.preventDefault();
    openUrlFromChat(href);
    return;
  }

  const filePath = resolveChatFilePathTarget(href, workspacePath);
  if (filePath == null) {
    return;
  }

  event.preventDefault();
  void openFilePathFromChat(workspacePath, filePath);
}

function ChatCodeBlock({
  children,
  code,
  language,
}: {
  children: ReactNode;
  code: string;
  language: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(() => {
    if (!navigator.clipboard?.writeText) {
      return;
    }

    void navigator.clipboard.writeText(code).then(() => {
      if (timerRef.current != null) {
        clearTimeout(timerRef.current);
      }

      setCopied(true);
      timerRef.current = setTimeout(() => {
        setCopied(false);
        timerRef.current = null;
      }, 1200);
    });
  }, [code]);

  useEffect(() => {
    return () => {
      if (timerRef.current != null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <div className={codeBlockClassName}>
      <div className={codeBlockHeaderClassName}>
        <span className={codeLanguageClassName}>{language ?? "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex h-6 items-center gap-1 rounded-md border border-black/10 bg-white/70 px-2 text-[11px] text-neutral-500 shadow-sm transition hover:text-neutral-900 dark:border-white/10 dark:bg-neutral-950/70 dark:text-neutral-400 dark:hover:text-neutral-100"
          aria-label={copied ? "Copied code" : "Copy code"}
          title={copied ? "Copied" : "Copy code"}
        >
          {copied ? <CheckIcon className="size-3" /> : <CopyIcon className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {children}
    </div>
  );
}

export function ChatMarkdown({ text, className, workspacePath }: ChatMarkdownProps) {
  return (
    <div
      className={cn(markdownRootClassName, CHAT_BODY_TEXT_CLASS, className)}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={chatMarkdownUrlTransform}
        components={{
          a: ({ children, href }) =>
            !href ? (
              <span className="text-sky-500 dark:text-sky-400">{children}</span>
            ) : (
              <a
                href={href}
                onClick={(event) => handleLinkClick(event, href, workspacePath)}
                rel="noreferrer"
                target="_blank"
                className="text-sky-500 transition hover:text-sky-600 dark:text-sky-400 dark:hover:text-sky-300"
              >
                {children}
              </a>
            ),
          h1: ({ children }) => (
            <h1 className={headingClassNames.h1}>
              <ChatInlineChildren workspacePath={workspacePath}>{children}</ChatInlineChildren>
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className={headingClassNames.h2}>
              <ChatInlineChildren workspacePath={workspacePath}>{children}</ChatInlineChildren>
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className={headingClassNames.h3}>
              <ChatInlineChildren workspacePath={workspacePath}>{children}</ChatInlineChildren>
            </h3>
          ),
          li: ({ children }) => (
            <li>
              <ChatInlineChildren workspacePath={workspacePath}>{children}</ChatInlineChildren>
            </li>
          ),
          p: ({ children }) => (
            <p>
              <ChatInlineChildren workspacePath={workspacePath}>{children}</ChatInlineChildren>
            </p>
          ),
          pre: ({ children, ...props }) => {
            const codeBlock = extractCodeBlock(children);
            if (codeBlock == null) {
              return <pre {...props}>{children}</pre>;
            }

            return (
              <ChatCodeBlock code={codeBlock.code} language={codeBlock.language}>
                <pre {...props}>{children}</pre>
              </ChatCodeBlock>
            );
          },
          strong: ({ children }) => (
            <strong className="font-semibold">
              <ChatInlineChildren workspacePath={workspacePath}>{children}</ChatInlineChildren>
            </strong>
          ),
          table: ({ children }) => (
            <div className="max-w-full overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
              <table className="min-w-full border-collapse text-left text-sm/6">{children}</table>
            </div>
          ),
          td: ({ children }) => (
            <td className="border-t border-black/10 px-2 py-1 align-top dark:border-white/10">
              <ChatInlineChildren workspacePath={workspacePath}>{children}</ChatInlineChildren>
            </td>
          ),
          th: ({ children }) => (
            <th className="border-b border-black/10 bg-black/5 px-2 py-1 text-left font-medium align-top dark:border-white/10 dark:bg-white/5">
              <ChatInlineChildren workspacePath={workspacePath}>{children}</ChatInlineChildren>
            </th>
          ),
          tr: ({ children }) => <tr className="align-top">{children}</tr>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
