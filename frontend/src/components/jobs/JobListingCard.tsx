import { Building2, Clock, MapPin, Wifi } from "lucide-react";
import { Link } from "react-router";

import { STATUS_BADGE_TONES } from "@/components/board/applicationStatusStyles";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/classNames";
import { formatJobSource, formatRelativeDate, getScoreTone } from "@/lib/formatters";
import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/types/application";
import type { JobSummary } from "@/types/job";

const MATCH_SCORE_CLASSES = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-slate-50 text-slate-600 ring-slate-200",
};

interface JobListingCardProperties {
  job: JobSummary;
  matchScore?: number;
  matchedKeywords?: string[];
}

// One job in the jobs list, with an optional match percentage for the selected CV.
export function JobListingCard({ job, matchScore, matchedKeywords }: JobListingCardProperties) {
  return (
    <Link
      to={`/jobs/${job.id}`}
      className="group flex gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-card)] transition hover:border-brand-200 hover:shadow-md sm:p-5"
    >
      <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 text-lg font-semibold text-slate-500 ring-1 ring-slate-200 sm:flex">
        {(job.company || job.title || "?").slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="font-semibold text-slate-900 group-hover:text-brand-700">{job.title || "Untitled job"}</h3>
          {matchScore !== undefined && (
            <span className={cn("rounded-full px-2.5 py-0.5 text-sm font-semibold ring-1 ring-inset", MATCH_SCORE_CLASSES[getScoreTone(matchScore)])}>
              {matchScore}% match
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
          <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{job.company || "Unknown company"}</span>
          {job.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location}</span>}
          {job.is_remote && <span className="inline-flex items-center gap-1 text-emerald-600"><Wifi className="h-3.5 w-3.5" />Remote</span>}
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{job.date_posted || formatRelativeDate(job.created_at)}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge tone="gray">{formatJobSource(job.source)}</Badge>
          {job.salary && <Badge tone="green">{job.salary}</Badge>}
          {job.job_type && <Badge tone="gray">{job.job_type}</Badge>}
          {job.application_status && (
            <Badge tone={STATUS_BADGE_TONES[job.application_status as ApplicationStatus]}>
              {APPLICATION_STATUS_LABELS[job.application_status as ApplicationStatus]}
            </Badge>
          )}
          {matchedKeywords?.slice(0, 5).map((keyword) => (
            <Badge key={keyword} tone="brand">{keyword}</Badge>
          ))}
        </div>
      </div>
    </Link>
  );
}
