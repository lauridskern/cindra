export type InlineTextSegment =
  | { kind: "text"; value: string }
  | { kind: "filename"; value: string };
