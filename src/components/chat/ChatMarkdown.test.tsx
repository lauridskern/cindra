import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ChatMarkdown } from "./ChatMarkdown";

describe("ChatMarkdown", () => {
  test("does not preserve whitespace across the shared markdown root", () => {
    const markup = renderToStaticMarkup(
      <ChatMarkdown text={"Title\n\nBody"} />,
    );

    expect(markup).toContain("grid min-w-0 gap-2 select-text");
    expect(markup).not.toContain("grid min-w-0 gap-2 whitespace-pre-wrap");
  });

  test("can preserve soft breaks inside reasoning paragraphs", () => {
    const markup = renderToStaticMarkup(
      <ChatMarkdown text={"Thinking title\nThinking body"} preserveSoftBreaks />,
    );

    expect(markup).toContain("[&amp;_p]:whitespace-pre-wrap");
    expect(markup).toContain("Thinking title\nThinking body");
  });

  test("repairs glued reasoning section titles", () => {
    const markup = renderToStaticMarkup(
      <ChatMarkdown
        text={
          "I need to keep everything up to date.Creating a concise summary\nSince the user requested a summary."
        }
        preserveSoftBreaks
      />,
    );

    expect(markup).toContain("up to date.</p>");
    expect(markup).toContain("<p>Creating a concise summary\nSince the user requested");
  });
});
