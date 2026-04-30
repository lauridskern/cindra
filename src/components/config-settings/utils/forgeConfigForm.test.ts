import { describe, expect, test } from "bun:test";

import {
  parseForgeConfigForm,
  updateForgeConfigField,
} from "./forgeConfigForm";

describe("forgeConfigForm", () => {
  test("groups editable fields by TOML section", () => {
    const sections = parseForgeConfigForm(`max_fetch_chars = 50000

[http]
adaptive_window = true
tls_backend = "default"
`);

    expect(sections).toHaveLength(2);
    expect(sections[0]?.title).toBe("General");
    expect(sections[0]?.fields.map((field) => field.key)).toEqual([
      "max_fetch_chars",
    ]);
    expect(sections[1]?.title).toBe("Http");
    expect(sections[1]?.fields.map((field) => field.key)).toEqual([
      "adaptive_window",
      "tls_backend",
    ]);
  });

  test("updates a field while preserving section headers and comments", () => {
    const contents = `# Forge
max_fetch_chars = 50000 # characters

[http]
adaptive_window = true
tls_backend = "default"
`;
    const [generalSection, httpSection] = parseForgeConfigForm(contents);
    const maxFetchChars = generalSection?.fields[0];
    const tlsBackend = httpSection?.fields.find(
      (field) => field.key === "tls_backend",
    );

    expect(maxFetchChars).toBeDefined();
    expect(tlsBackend).toBeDefined();

    const updatedNumber = updateForgeConfigField(
      contents,
      maxFetchChars!,
      "60000",
    );
    const updatedString = updateForgeConfigField(
      updatedNumber,
      parseForgeConfigForm(updatedNumber)[1]!.fields.find(
        (field) => field.key === "tls_backend",
      )!,
      "rustls",
    );

    expect(updatedString).toBe(`# Forge
max_fetch_chars = 60000 # characters

[http]
adaptive_window = true
tls_backend = "rustls"
`);
  });

  test("updates boolean fields from select values", () => {
    const contents = `[http]
adaptive_window = true
`;
    const field = parseForgeConfigForm(contents)[0]!.fields[0]!;

    expect(updateForgeConfigField(contents, field, "false")).toBe(`[http]
adaptive_window = false
`);
  });

  test("handles array of table headers as sections", () => {
    const sections = parseForgeConfigForm(`[[providers]]
id = "local"
url = "http://localhost:1234"
`);

    expect(sections[0]?.title).toBe("Providers");
    expect(sections[0]?.fields.map((field) => field.key)).toEqual([
      "id",
      "url",
    ]);
  });

  test("omits schema metadata rows", () => {
    const sections = parseForgeConfigForm(`"$schema" = "https://example.com/schema.json"
model = "gpt-5"
`);

    expect(sections[0]?.fields.map((field) => field.key)).toEqual(["model"]);
  });

  test("omits app-managed sections", () => {
    const sections = parseForgeConfigForm(`[updates]
auto_update = true

[reasoning]
enabled = true
effort = [
    "medium",
]

[retry]
max_attempts = 8
`);

    expect(sections).toHaveLength(1);
    expect(sections[0]?.name).toBe("retry");
    expect(sections[0]?.fields.map((field) => field.key)).toEqual([
      "max_attempts",
    ]);
  });

  test("reads and updates multi-line arrays as one field", () => {
    const contents = `[retry]
status_codes = [
    429,
    500,
]
suppress_errors = false
`;
    const section = parseForgeConfigForm(contents)[0]!;
    const statusCodes = section.fields[0]!;

    expect(statusCodes.key).toBe("status_codes");
    expect(statusCodes.valueKind).toBe("array");
    expect(statusCodes.inputValue).toBe(`[
    429,
    500,
]`);
    expect(section.fields[1]?.key).toBe("suppress_errors");

    expect(
      updateForgeConfigField(
        contents,
        statusCodes,
        `[
    408,
    429,
]`,
      ),
    ).toBe(`[retry]
status_codes = [
    408,
    429,
]
suppress_errors = false
`);
  });
});
