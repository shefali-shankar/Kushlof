import type { BadgeTone } from "@/components/ui/Badge";
import type { ApplicationStatus } from "@/types/application";

// Colour used for each board column's badge and accent.
export const STATUS_BADGE_TONES: Record<ApplicationStatus, BadgeTone> = {
  saved: "gray",
  tailoring: "violet",
  ready_to_apply: "amber",
  applied: "blue",
  interview: "brand",
  offer: "green",
  rejected: "red",
};

export const STATUS_ACCENT_CLASSES: Record<ApplicationStatus, string> = {
  saved: "bg-slate-400",
  tailoring: "bg-violet-500",
  ready_to_apply: "bg-amber-500",
  applied: "bg-sky-500",
  interview: "bg-brand-500",
  offer: "bg-emerald-500",
  rejected: "bg-red-500",
};
