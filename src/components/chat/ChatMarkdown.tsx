import ReactMarkdown from "react-markdown";

import { cn } from "../../lib/utils";

interface ChatMarkdownProps {
  text: string;
  className?: string;
}

export function ChatMarkdown({ text, className }: ChatMarkdownProps) {
  return (
    <div
      className={cn(
        "grid min-w-0 gap-3 select-text [&_code]:font-mono [&_li]:m-0 [&_li>p]:m-0 [&_ol]:m-0 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:m-0 [&_pre]:m-0 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:overflow-y-hidden [&_pre]:whitespace-pre [&_pre]:break-normal [&_pre_code]:inline-block [&_pre_code]:min-w-full [&_pre_code]:w-max [&_pre_code]:align-top [&_pre_code]:whitespace-pre [&_ul]:m-0 [&_ul]:list-disc [&_ul]:pl-5",
        className,
      )}
    >
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="m-0 text-sm font-semibold leading-6 text-current">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="m-0 text-sm font-semibold leading-6 text-current">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="m-0 text-sm font-medium leading-6 text-current">
              {children}
            </h3>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
