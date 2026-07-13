import { describe, expect, test } from "bun:test";

import { parseChangedFilesSummary } from "./changedFilesSummary";

describe("parseChangedFilesSummary", () => {
  test("parses the changed-files status output emitted by the backend", () => {
    expect(
      parseChangedFilesSummary(
        [
          "Changed 2 files:",
          "- `src/app.tsx` +82 -12",
          "- `src/new.ts` +4 -0",
        ].join("\n"),
      ),
    ).toEqual({
      count: 2,
      files: [
        { path: "src/app.tsx", additions: 82, deletions: 12 },
        { path: "src/new.ts", additions: 4, deletions: 0 },
      ],
    });
  });

  test("parses binary diff stat placeholders", () => {
    expect(
      parseChangedFilesSummary("Changed 1 file:\n- `src/image.png` +- --"),
    ).toEqual({
      count: 1,
      files: [{ path: "src/image.png", additions: null, deletions: null }],
    });
  });

  test("ignores unrelated status output", () => {
    expect(parseChangedFilesSummary("compaction summary:\n- kept context")).toBeNull();
  });

  test("rejects summaries whose count does not match the file list", () => {
    expect(
      parseChangedFilesSummary("Changed 2 files:\n- `src/app.tsx` +1 -0"),
    ).toBeNull();
  });
});
