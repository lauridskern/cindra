import { FILENAME_PATTERN } from "../constants/inlineText";
import type { InlineTextSegment } from "../types/inlineText";

export function getInlineTextSegments(text: string): InlineTextSegment[] {
  const segments: InlineTextSegment[] = [];
  let match: RegExpExecArray | null;
  let lastIndex = 0;

  FILENAME_PATTERN.lastIndex = 0;

  while ((match = FILENAME_PATTERN.exec(text)) !== null) {
    const [fullMatch, filename] = match;
    const matchStart = match.index;
    const matchEnd = matchStart + fullMatch.length;

    if (matchStart > lastIndex) {
      segments.push({ kind: "text", value: text.slice(lastIndex, matchStart) });
    }

    segments.push({ kind: "filename", value: filename });
    lastIndex = matchEnd;
  }

  if (lastIndex < text.length) {
    segments.push({ kind: "text", value: text.slice(lastIndex) });
  }

  return segments;
}
