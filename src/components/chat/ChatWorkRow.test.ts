import { describe, expect, test } from "bun:test";

import { getWorkHeaderLabelText } from "./ChatWorkRow";

describe("getWorkHeaderLabelText", () => {
  test("reports completed requests with failed steps explicitly", () => {
    expect(
      getWorkHeaderLabelText({
        failedStepCount: 1,
        isRunning: false,
      }),
    ).toBe("Completed with 1 failed step");
  });

  test("pluralizes failed steps and includes duration when available", () => {
    expect(
      getWorkHeaderLabelText({
        failedStepCount: 2,
        isRunning: false,
        requestTiming: {
          startedAtMs: 1_000,
          completedAtMs: 6_000,
        },
      }),
    ).toBe("Completed with 2 failed steps after 5s");
  });

  test("keeps the running label unchanged", () => {
    expect(
      getWorkHeaderLabelText({
        failedStepCount: 0,
        isRunning: true,
        requestTiming: {
          startedAtMs: 2_000,
        },
        nowMs: 5_000,
      }),
    ).toBe("Working for 3s");
  });
});
