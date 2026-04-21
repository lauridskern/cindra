import { ActivityResultCard, ActivityResultPreformattedBody } from "./ActivityResultCard";
import type { ActivityResultModel } from "./activityResultModel";

interface TextResultProps {
  result: Extract<ActivityResultModel, { kind: "text" }>;
}

export function TextResult({ result }: TextResultProps) {
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
