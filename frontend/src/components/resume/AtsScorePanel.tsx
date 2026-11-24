import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Lightbulb, Sparkles, XCircle } from "lucide-react";
import { toast } from "sonner";

import { fetchJobs } from "@/api/jobs";
import { fetchAtsScore, requestAiReview } from "@/api/resumes";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, SelectInput } from "@/components/ui/FormFields";
import { ScoreBar, ScoreRing } from "@/components/ui/ScoreRing";
import { ErrorState, LoadingState } from "@/components/ui/StatusDisplays";
import { getErrorMessage } from "@/lib/formatters";
import type { ResumeSuggestion, SuggestionSection } from "@/types/resume";

const SECTION_LABELS: Record<SuggestionSection, string> = {
  basics: "Contact details",
  summary: "Summary",
  work: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
  general: "Overall",
};

const SEVERITY_TONES = { high: "red", medium: "amber", low: "gray" } as const;

interface AtsScorePanelProperties {
  resumeId: number;
  selectedJobId: number | null;
  onSelectedJobChange: (jobId: number | null) => void;
  onGoToSection: (section: SuggestionSection) => void;
  hasUnsavedChanges: boolean;
  savedVersionTimestamp: string;
}

function SuggestionList({ suggestions, onGoToSection }: { suggestions: ResumeSuggestion[]; onGoToSection: (section: SuggestionSection) => void }) {
  return (
    <ul className="space-y-2">
      {suggestions.map((suggestion, suggestionIndex) => (
        <li key={suggestionIndex}>
          <button
            type="button"
            onClick={() => onGoToSection(suggestion.section)}
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-brand-300 hover:bg-brand-50/40"
          >
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <Badge tone={SEVERITY_TONES[suggestion.severity]}>{suggestion.severity}</Badge>
              <Badge tone="gray">{SECTION_LABELS[suggestion.section]}</Badge>
              {suggestion.source === "ai" && (
                <Badge tone="violet">
                  <Sparkles className="h-3 w-3" /> AI
                </Badge>
              )}
            </div>
            <p className="text-sm text-slate-700">{suggestion.message}</p>
          </button>
        </li>
      ))}
    </ul>
  );
}

// Shows the CV's ATS score, its breakdown, keyword coverage for a chosen job, and clickable suggestions.
export function AtsScorePanel({
  resumeId,
  selectedJobId,
  onSelectedJobChange,
  onGoToSection,
  hasUnsavedChanges,
  savedVersionTimestamp,
}: AtsScorePanelProperties) {
  const { data: jobs = [] } = useQuery({ queryKey: ["jobs", "for-picker"], queryFn: () => fetchJobs() });
  const scoreQuery = useQuery({
    queryKey: ["ats-score", resumeId, selectedJobId, savedVersionTimestamp],
    queryFn: () => fetchAtsScore(resumeId, selectedJobId),
  });
  const aiReviewMutation = useMutation({
    mutationFn: () => requestAiReview(resumeId, selectedJobId),
    onError: (reviewError) => toast.error(getErrorMessage(reviewError)),
  });

  const scoreReport = scoreQuery.data;

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-4">
          <Field label="Score against a job (optional)">
            <SelectInput value={selectedJobId ?? ""} onChange={(changeEvent) => onSelectedJobChange(changeEvent.target.value ? Number(changeEvent.target.value) : null)}>
              <option value="">General ATS check (no job)</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} — {job.company || "Unknown company"}
                </option>
              ))}
            </SelectInput>
          </Field>
          {hasUnsavedChanges && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Save your changes to update the score.</p>}

          {scoreQuery.isLoading && <LoadingState message="Scoring…" className="py-8" />}
          {scoreQuery.error && <ErrorState error={scoreQuery.error} />}
          {scoreReport && (
            <div className="flex items-center gap-5">
              <ScoreRing score={scoreReport.total_score} size={104} label="ATS score" />
              <div className="flex-1 space-y-3">
                <ScoreBar label="Keyword match" score={scoreReport.keyword_score} />
                <ScoreBar label="Formatting" score={scoreReport.formatting_score} />
                <ScoreBar label="Content quality" score={scoreReport.content_score} />
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {scoreReport && scoreReport.keyword_score !== null && (
        <Card>
          <CardHeader title="Job keywords" description={`${scoreReport.matched_keywords.length} of ${scoreReport.matched_keywords.length + scoreReport.missing_keywords.length} found in your CV`} />
          <CardBody className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {scoreReport.matched_keywords.map((keyword) => (
                <Badge key={keyword} tone="green">
                  <CheckCircle2 className="h-3 w-3" /> {keyword}
                </Badge>
              ))}
              {scoreReport.missing_keywords.map((keyword) => (
                <Badge key={keyword} tone="red">
                  <XCircle className="h-3 w-3" /> {keyword}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-slate-500">Only add missing keywords for skills you genuinely have.</p>
          </CardBody>
        </Card>
      )}

      {scoreReport && (
        <Card>
          <CardHeader
            title="Suggestions"
            icon={<Lightbulb className="h-4 w-4" />}
            description="Click a suggestion to jump to that section."
            actions={
              <Button size="sm" variant="secondary" isLoading={aiReviewMutation.isPending} onClick={() => aiReviewMutation.mutate()}>
                {!aiReviewMutation.isPending && <Sparkles className="h-4 w-4" />} AI review
              </Button>
            }
          />
          <CardBody className="space-y-4">
            {aiReviewMutation.isPending && <p className="text-sm text-slate-500">The AI is reviewing your CV. This can take a minute…</p>}
            {aiReviewMutation.data && aiReviewMutation.data.length > 0 && (
              <SuggestionList suggestions={aiReviewMutation.data} onGoToSection={onGoToSection} />
            )}
            {scoreReport.suggestions.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> No issues found by the automatic checks.
              </p>
            ) : (
              <SuggestionList suggestions={scoreReport.suggestions} onGoToSection={onGoToSection} />
            )}
          </CardBody>
        </Card>
      )}

      {scoreReport && (
        <Card>
          <CardHeader title="All checks" />
          <ul className="divide-y divide-slate-100">
            {scoreReport.checks.map((check) => (
              <li key={check.name} className="flex items-center gap-2.5 px-5 py-2.5 text-sm">
                {check.passed ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <XCircle className="h-4 w-4 shrink-0 text-red-500" />}
                <span className={check.passed ? "text-slate-700" : "text-slate-900"}>{check.name}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
