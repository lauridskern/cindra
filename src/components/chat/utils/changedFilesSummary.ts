export interface ChangedFilesSummaryItem {
  path: string;
  additions: number | null;
  deletions: number | null;
}

export interface ChangedFilesSummary {
  count: number;
  files: ChangedFilesSummaryItem[];
}

const CHANGED_FILES_HEADER_PATTERN = /^Changed (\d+) files?:$/;
const CHANGED_FILE_ITEM_PATTERN = /^-\s+`([^`]+)`\s+\+(\d+|-)\s+-(\d+|-)$/;

export function parseChangedFilesSummary(
  text: string,
): ChangedFilesSummary | null {
  const lines = text
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const headerMatch = lines[0]?.match(CHANGED_FILES_HEADER_PATTERN);

  if (headerMatch == null) {
    return null;
  }

  const count = Number.parseInt(headerMatch[1], 10);
  const files: ChangedFilesSummaryItem[] = [];

  for (const line of lines.slice(1)) {
    const itemMatch = line.match(CHANGED_FILE_ITEM_PATTERN);
    if (itemMatch == null) {
      return null;
    }

    files.push({
      path: itemMatch[1],
      additions: parseChangedFileStat(itemMatch[2]),
      deletions: parseChangedFileStat(itemMatch[3]),
    });
  }

  if (Number.isSafeInteger(count) === false || count !== files.length) {
    return null;
  }

  return {
    count,
    files,
  };
}

function parseChangedFileStat(value: string | undefined): number | null {
  if (value == null || value === "-") {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
