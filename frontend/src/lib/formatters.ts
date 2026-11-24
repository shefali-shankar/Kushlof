// Small display helpers used across pages.

export function formatRelativeDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  const parsedDate = new Date(isoDate.endsWith("Z") || isoDate.includes("+") ? isoDate : `${isoDate}Z`);
  const secondsAgo = Math.round((Date.now() - parsedDate.getTime()) / 1000);
  if (secondsAgo < 60) return "just now";
  if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)} min ago`;
  if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)} h ago`;
  if (secondsAgo < 86400 * 7) return `${Math.floor(secondsAgo / 86400)} d ago`;
  return parsedDate.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatJobSource(source: string): string {
  const sourceLabels: Record<string, string> = {
    linkedin: "LinkedIn",
    indeed: "Indeed",
    glassdoor: "Glassdoor",
    google: "Google Jobs",
    zip_recruiter: "ZipRecruiter",
    imported: "Imported link",
    pasted: "Pasted",
  };
  return sourceLabels[source] ?? source;
}

export function getScoreTone(score: number): "green" | "amber" | "red" {
  if (score >= 75) return "green";
  if (score >= 50) return "amber";
  return "red";
}

export function getErrorMessage(caughtError: unknown): string {
  return caughtError instanceof Error ? caughtError.message : "Something went wrong.";
}
