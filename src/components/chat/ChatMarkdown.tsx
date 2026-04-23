import ReactMarkdown from "react-markdown";

import { cn } from "@/utils/cn";
import { CHAT_BODY_TEXT_CLASS } from "./constants/chatStyles";
import { ChatInlineChildren } from "./ChatInlineText";
import type { ChatMarkdownProps } from "./types/chatComponents";

const headingClassName = cn("m-0 font-medium text-current", CHAT_BODY_TEXT_CLASS);

export function ChatMarkdown({ text, className }: ChatMarkdownProps) {
  return (
    <div
      className={cn(
        "grid min-w-0 gap-2 select-text [&_code]:rounded-md [&_code]:bg-neutral-200/60 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_code]:text-neutral-900 dark:[&_code]:bg-neutral-800/60 dark:[&_code]:text-neutral-100 [&_li]:m-0 [&_li>p]:m-0 [&_ol]:m-0 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:m-0 [&_pre]:m-0 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:overflow-y-hidden [&_pre]:whitespace-pre [&_pre]:break-normal [&_pre_code]:inline-block [&_pre_code]:min-w-full [&_pre_code]:w-max [&_pre_code]:align-top [&_pre_code]:whitespace-pre [&_pre_code]:rounded-none [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_ul]:m-0 [&_ul]:list-disc [&_ul]:pl-5",
        CHAT_BODY_TEXT_CLASS,
        className,
      )}
    >
      <ReactMarkdown
        components={{
          a: ({ children, href }) =>
            !href || href.startsWith("/") ? (
              <span className="text-sky-500 dark:text-sky-400">{children}</span>
            ) : (
              <a
                href={href}
                rel="noreferrer"
                target="_blank"
                className="text-sky-500 transition hover:text-sky-600 dark:text-sky-400 dark:hover:text-sky-300"
              >
                {children}
              </a>
            ),
          h1: ({ children }) => (
            <h1 className={headingClassName}>
              <ChatInlineChildren>{children}</ChatInlineChildren>
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className={headingClassName}>
              <ChatInlineChildren>{children}</ChatInlineChildren>
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className={headingClassName}>
              <ChatInlineChildren>{children}</ChatInlineChildren>
            </h3>
          ),
          li: ({ children }) => (
            <li>
              <ChatInlineChildren>{children}</ChatInlineChildren>
            </li>
          ),
          p: ({ children }) => (
            <p>
              <ChatInlineChildren>{children}</ChatInlineChildren>
            </p>
          ),
          strong: ({ children }) => (
            <span className="font-medium">
              <ChatInlineChildren>{children}</ChatInlineChildren>
            </span>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
