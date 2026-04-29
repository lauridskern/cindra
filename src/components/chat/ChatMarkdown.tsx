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

const headingClassName = cn("m-0 font-medium text-current", CHAT_BODY_TEXT_CLASS);
const codeBlockClassName =
  "group/code relative max-w-full overflow-hidden rounded-xl border border-black/10 bg-neutral-100/70 dark:border-white/10 dark:bg-neutral-900/70";

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

function extractCodeBlock(children: ReactNode): string | null {
  const childNodes = Children.toArray(children);
  if (childNodes.length !== 1) {
    return null;
  }

  const onlyChild = childNodes[0];
  if (!isValidElement<{ children?: ReactNode }>(onlyChild) || onlyChild.type !== "code") {
    return null;
  }

  return nodeToPlainText(onlyChild.props.children);
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

function ChatCodeBlock({ children, code }: { children: ReactNode; code: string }) {
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
      <button
        type="button"
        onClick={handleCopy}
        className="absolute top-2 right-2 inline-flex size-7 items-center justify-center rounded-md border border-black/10 bg-white/80 text-neutral-500 opacity-0 shadow-sm transition group-hover/code:opacity-100 hover:text-neutral-900 dark:border-white/10 dark:bg-neutral-950/80 dark:text-neutral-400 dark:hover:text-neutral-100"
        aria-label={copied ? "Copied code" : "Copy code"}
        title={copied ? "Copied" : "Copy code"}
      >
        {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
      </button>
      {children}
    </div>
  );
}

export function ChatMarkdown({ text, className, workspacePath }: ChatMarkdownProps) {
  return (
    <div
      className={cn(
        "grid min-w-0 gap-2 select-text [&_blockquote]:border-l-2 [&_blockquote]:border-neutral-300 [&_blockquote]:pl-3 [&_blockquote]:text-neutral-600 dark:[&_blockquote]:border-neutral-700 dark:[&_blockquote]:text-neutral-400 [&_code]:rounded-md [&_code]:bg-neutral-200/60 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_code]:text-neutral-900 dark:[&_code]:bg-neutral-800/60 dark:[&_code]:text-neutral-100 [&_hr]:border-black/10 dark:[&_hr]:border-white/10 [&_li]:m-0 [&_li>p]:m-0 [&_ol]:m-0 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:m-0 [&_pre]:m-0 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:overflow-y-hidden [&_pre]:whitespace-pre [&_pre]:break-normal [&_pre]:p-3 [&_pre]:pr-12 [&_pre_code]:inline-block [&_pre_code]:min-w-full [&_pre_code]:w-max [&_pre_code]:align-top [&_pre_code]:whitespace-pre [&_pre_code]:rounded-none [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_td]:border [&_td]:border-black/10 [&_td]:px-2 [&_td]:py-1 dark:[&_td]:border-white/10 [&_th]:border [&_th]:border-black/10 [&_th]:px-2 [&_th]:py-1 [&_th]:font-medium dark:[&_th]:border-white/10 [&_ul]:m-0 [&_ul]:list-disc [&_ul]:pl-5",
        CHAT_BODY_TEXT_CLASS,
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={chatMarkdownUrlTransform}
        components={{
          a: ({ children, href }) =>
            !href ? (
              <span className="text-sky-500 dark:text-sky-400">
                <ChatInlineChildren workspacePath={workspacePath}>{children}</ChatInlineChildren>
              </span>
            ) : (
              <a
                href={href}
                onClick={(event) => handleLinkClick(event, href, workspacePath)}
                rel="noreferrer"
                target="_blank"
                className="text-sky-500 transition hover:text-sky-600 dark:text-sky-400 dark:hover:text-sky-300"
              >
                <ChatInlineChildren workspacePath={workspacePath}>{children}</ChatInlineChildren>
              </a>
            ),
          h1: ({ children }) => (
            <h1 className={headingClassName}>
              <ChatInlineChildren workspacePath={workspacePath}>{children}</ChatInlineChildren>
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className={headingClassName}>
              <ChatInlineChildren workspacePath={workspacePath}>{children}</ChatInlineChildren>
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className={headingClassName}>
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
            const code = extractCodeBlock(children);
            if (code == null) {
              return <pre {...props}>{children}</pre>;
            }

            return (
              <ChatCodeBlock code={code}>
                <pre {...props}>{children}</pre>
              </ChatCodeBlock>
            );
          },
          strong: ({ children }) => (
            <span className="font-medium">
              <ChatInlineChildren workspacePath={workspacePath}>{children}</ChatInlineChildren>
            </span>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
