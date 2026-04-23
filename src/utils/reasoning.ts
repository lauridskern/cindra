export function formatReasoningEffortLabel(value: string): string {
  if (value === "xhigh") {
    return "XHigh";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}
