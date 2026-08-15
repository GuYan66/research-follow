import { sourceClass, sourceLabel } from "@/lib/utils";

export function SourceBadge({ sources }: { sources: string[] }) {
  if (!sources || sources.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1">
      {sources.map((s) => (
        <span
          key={s}
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${sourceClass(s)}`}
          title={`来源：${sourceLabel(s)}`}
        >
          {sourceLabel(s)}
        </span>
      ))}
    </span>
  );
}
