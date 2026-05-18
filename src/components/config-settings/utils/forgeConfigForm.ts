export type ForgeConfigValueKind =
  | "array"
  | "boolean"
  | "inline_table"
  | "number"
  | "raw"
  | "string";

export type ForgeConfigField = {
  endLineIndex: number;
  id: string;
  inputValue: string;
  key: string;
  label: string;
  lineIndex: number;
  sectionName: string;
  valueKind: ForgeConfigValueKind;
};

export type ForgeConfigSection = {
  fields: ForgeConfigField[];
  id: string;
  name: string;
  title: string;
};

type AssignmentParts = {
  indentation: string;
  key: string;
  separator: string;
  suffix: string;
  value: string;
};

type TomlScanResult = {
  braces: number;
  brackets: number;
  topLevelCommentIndex: number | null;
};

const ASSIGNMENT_PATTERN =
  /^(\s*)([A-Za-z0-9_.-]+|"[^"]+"|'[^']+')(\s*=\s*)(.*)$/;
const OMITTED_SECTION_NAMES = new Set(["reasoning", "updates"]);
const SECTION_PATTERN =
  /^\s*(?:\[([^[\]]+)\]|\[\[([^[\]]+)\]\])\s*(?:#.*)?$/;

export function parseForgeConfigForm(contents: string): ForgeConfigSection[] {
  const sections = new Map<string, ForgeConfigSection>();
  const lines = contents.split("\n");
  let currentSectionName = "";

  function getSection(name: string): ForgeConfigSection {
    const id = name || "root";
    const existing = sections.get(id);
    if (existing) {
      return existing;
    }

    const section = {
      fields: [],
      id,
      name,
      title: formatSectionTitle(name),
    };
    sections.set(id, section);
    return section;
  }

  let lineIndex = 0;
  while (lineIndex < lines.length) {
    const line = lines[lineIndex] ?? "";
    const sectionMatch = line.match(SECTION_PATTERN);
    if (sectionMatch) {
      currentSectionName = (sectionMatch[1] ?? sectionMatch[2] ?? "").trim();
      lineIndex += 1;
      continue;
    }

    const assignment = parseAssignmentLine(line);
    if (assignment == null) {
      lineIndex += 1;
      continue;
    }

    if (normalizeConfigKey(assignment.key) === "$schema") {
      lineIndex += 1;
      continue;
    }

    if (shouldOmitSection(currentSectionName)) {
      lineIndex =
        readValueLineRange(lines, lineIndex, assignment.value).endLineIndex + 1;
      continue;
    }

    const { endLineIndex, rawValue } = readValueLineRange(
      lines,
      lineIndex,
      assignment.value,
    );
    const valueKind = getValueKind(rawValue);
    getSection(currentSectionName).fields.push({
      endLineIndex,
      id: `${lineIndex}:${currentSectionName}:${assignment.key}`,
      inputValue: getInputValue(rawValue, valueKind),
      key: assignment.key,
      label: formatConfigLabel(assignment.key),
      lineIndex,
      sectionName: currentSectionName,
      valueKind,
    });
    lineIndex = endLineIndex + 1;
  }

  return [...sections.values()].filter((section) => section.fields.length > 0);
}

export function updateForgeConfigField(
  contents: string,
  field: ForgeConfigField,
  nextInputValue: string,
): string {
  const lines = contents.split("\n");
  const currentLine = lines[field.lineIndex];
  if (currentLine == null) {
    return contents;
  }

  const assignment = parseAssignmentLine(currentLine);
  if (assignment == null || assignment.key !== field.key) {
    return contents;
  }

  const nextValue = formatConfigValue(field, nextInputValue);
  const nextLines = `${assignment.indentation}${assignment.key}${assignment.separator}${nextValue}${assignment.suffix}`.split(
    "\n",
  );
  lines.splice(
    field.lineIndex,
    field.endLineIndex - field.lineIndex + 1,
    ...nextLines,
  );

  return lines.join("\n");
}

function readValueLineRange(
  lines: string[],
  startLineIndex: number,
  firstLineValue: string,
) {
  let endLineIndex = startLineIndex;
  let rawValue = firstLineValue.trimEnd();

  while (hasOpenValueContainer(rawValue) && endLineIndex + 1 < lines.length) {
    endLineIndex += 1;
    const nextValueLine = (lines[endLineIndex] ?? "").trimEnd();
    rawValue = `${rawValue}\n${nextValueLine}`;
  }

  return {
    endLineIndex,
    rawValue: rawValue.trim(),
  };
}

function parseAssignmentLine(line: string): AssignmentParts | null {
  const match = line.match(ASSIGNMENT_PATTERN);
  if (match == null) {
    return null;
  }

  const [, indentation, key, separator, remainder] = match;
  const { suffix, value } = splitTomlValueAndSuffix(remainder ?? "");

  return {
    indentation: indentation ?? "",
    key: key ?? "",
    separator: separator ?? " = ",
    suffix,
    value,
  };
}

function splitTomlValueAndSuffix(remainder: string) {
  const scan = scanTomlValue(remainder);
  if (scan.topLevelCommentIndex != null) {
    const value = remainder.slice(0, scan.topLevelCommentIndex).trimEnd();
    return {
      suffix: remainder.slice(value.length),
      value,
    };
  }

  return {
    suffix: remainder.slice(remainder.trimEnd().length),
    value: remainder.trimEnd(),
  };
}

function hasOpenValueContainer(value: string) {
  const scan = scanTomlValue(value);
  return scan.brackets > 0 || scan.braces > 0;
}

function scanTomlValue(value: string): TomlScanResult {
  let brackets = 0;
  let braces = 0;
  let inBasicString = false;
  let inLiteralString = false;
  let isEscaped = false;
  let topLevelCommentIndex: number | null = null;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (inBasicString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (character === "\\") {
        isEscaped = true;
        continue;
      }

      if (character === '"') {
        inBasicString = false;
      }
      continue;
    }

    if (inLiteralString) {
      if (character === "'") {
        inLiteralString = false;
      }
      continue;
    }

    if (character === "#") {
      if (brackets === 0 && braces === 0) {
        topLevelCommentIndex = index;
        break;
      }

      const nextLineIndex = value.indexOf("\n", index);
      if (nextLineIndex === -1) {
        break;
      }
      index = nextLineIndex;
      continue;
    }

    if (character === '"') {
      inBasicString = true;
      continue;
    }

    if (character === "'") {
      inLiteralString = true;
      continue;
    }

    if (character === "[") {
      brackets += 1;
      continue;
    }

    if (character === "]") {
      brackets = Math.max(0, brackets - 1);
      continue;
    }

    if (character === "{") {
      braces += 1;
      continue;
    }

    if (character === "}") {
      braces = Math.max(0, braces - 1);
    }
  }

  return { braces, brackets, topLevelCommentIndex };
}

function getValueKind(rawValue: string): ForgeConfigValueKind {
  if (/^(true|false)$/i.test(rawValue)) {
    return "boolean";
  }

  if (isQuotedString(rawValue)) {
    return "string";
  }

  if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
    return "array";
  }

  if (rawValue.startsWith("{") && rawValue.endsWith("}")) {
    return "inline_table";
  }

  if (/^[+-]?(?:\d[\d_]*)(?:\.\d[\d_]*)?(?:[eE][+-]?\d[\d_]*)?$/.test(rawValue)) {
    return "number";
  }

  return "raw";
}

function getInputValue(rawValue: string, valueKind: ForgeConfigValueKind) {
  if (valueKind === "boolean") {
    return rawValue.toLowerCase();
  }

  if (valueKind === "string") {
    return unquoteString(rawValue);
  }

  return rawValue;
}

function formatConfigValue(
  field: ForgeConfigField,
  nextInputValue: string,
): string {
  if (field.valueKind === "boolean") {
    return nextInputValue === "true" ? "true" : "false";
  }

  if (field.valueKind === "string") {
    return JSON.stringify(nextInputValue);
  }

  return nextInputValue.trim();
}

function isQuotedString(value: string) {
  return (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  );
}

function unquoteString(value: string) {
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }

  return value;
}

function formatConfigLabel(key: string) {
  return normalizeConfigKey(key)
    .split(/[_.-]/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeConfigKey(key: string) {
  return key.replace(/^["']|["']$/g, "");
}

function shouldOmitSection(sectionName: string) {
  return OMITTED_SECTION_NAMES.has(sectionName.trim().toLowerCase());
}

function formatSectionTitle(name: string) {
  if (name.length === 0) {
    return "General";
  }

  return name
    .split(".")
    .filter((part) => part.length > 0)
    .map(formatConfigLabel)
    .join(" / ");
}
