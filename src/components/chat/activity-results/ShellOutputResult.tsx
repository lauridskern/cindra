import { ActivityResultCard, ActivityResultPreformattedBody } from "./ActivityResultCard";
import type { ActivityResultModel } from "./activityResultModel";

interface ShellOutputResultProps {
  result: Extract<ActivityResultModel, { kind: "shell" }>;
}

export function ShellOutputResult({ result }: ShellOutputResultProps) {
  return (
    <ActivityResultCard
      title={result.title}
      copyText={result.copyText}
      footer={result.footer}
    >
      <ActivityResultPreformattedBody text={result.text} />
    </ActivityResultCard>
  );
}
