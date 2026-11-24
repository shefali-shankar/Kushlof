import { cn } from "@/lib/classNames";
import { getScoreTone } from "@/lib/formatters";

const TONE_STROKE_CLASSES = { green: "stroke-emerald-500", amber: "stroke-amber-500", red: "stroke-red-500" };

interface ScoreRingProperties {
  score: number;
  size?: number;
  label?: string;
  className?: string;
}

// A circular progress dial showing a 0–100 score, coloured green/amber/red.
export function ScoreRing({ score, size = 96, label, className }: ScoreRingProperties) {
  const strokeWidth = Math.max(6, size / 12);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, score));
  const tone = getScoreTone(clampedScore);

  return (
    <div className={cn("relative inline-flex flex-col items-center", className)} style={{ width: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} className="fill-none stroke-slate-100" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clampedScore / 100)}
          className={cn("fill-none transition-[stroke-dashoffset] duration-700", TONE_STROKE_CLASSES[tone])}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center" style={{ height: size }}>
        <span className="font-bold text-slate-900" style={{ fontSize: size / 3.6 }}>
          {Math.round(clampedScore)}
        </span>
      </div>
      {label && <span className="mt-1 text-xs font-medium text-slate-500">{label}</span>}
    </div>
  );
}

// A thin horizontal bar for sub-scores.
export function ScoreBar({ label, score }: { label: string; score: number | null }) {
  const tone = score === null ? null : getScoreTone(score);
  const barColour = tone === "green" ? "bg-emerald-500" : tone === "amber" ? "bg-amber-500" : "bg-red-500";
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="text-slate-500">{score === null ? "Pick a job" : `${score}%`}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        {score !== null && <div className={cn("h-full rounded-full transition-all duration-700", barColour)} style={{ width: `${score}%` }} />}
      </div>
    </div>
  );
}
