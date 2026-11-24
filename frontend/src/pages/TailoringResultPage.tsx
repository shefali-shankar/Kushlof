import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Download, ExternalLink, Mail, PencilLine } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { generateCoverLetter } from "@/api/applications";
import { fetchJob } from "@/api/jobs";
import { downloadResume, fetchAtsScore, fetchResume } from "@/api/resumes";
import { ResumeComparison } from "@/components/resume/ResumeComparison";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { ErrorState, LoadingState, WorkingBanner } from "@/components/ui/StatusDisplays";
import { getErrorMessage } from "@/lib/formatters";

// Shows the result of tailoring: score before → after, what changed, and next steps.
export default function TailoringResultPage() {
  const jobId = Number(useParams().jobId);
  const tailoredResumeId = Number(useParams().resumeId);
  const navigate = useNavigate();

  const { data: job } = useQuery({ queryKey: ["job", jobId], queryFn: () => fetchJob(jobId) });
  const { data: tailoredResume, isLoading, error } = useQuery({ queryKey: ["resume", tailoredResumeId], queryFn: () => fetchResume(tailoredResumeId) });
  const originalResumeId = tailoredResume?.based_on_resume_id ?? null;
  const { data: originalResume } = useQuery({
    queryKey: ["resume", originalResumeId],
    queryFn: () => fetchResume(originalResumeId!),
    enabled: originalResumeId !== null,
  });
  const { data: scoreAfter } = useQuery({ queryKey: ["ats-score", tailoredResumeId, jobId, tailoredResume?.updated_at], queryFn: () => fetchAtsScore(tailoredResumeId, jobId) });
  const { data: scoreBefore } = useQuery({
    queryKey: ["ats-score", originalResumeId, jobId, originalResume?.updated_at],
    queryFn: () => fetchAtsScore(originalResumeId!, jobId),
    enabled: originalResumeId !== null,
  });

  const coverLetterMutation = useMutation({
    mutationFn: () => generateCoverLetter(jobId, tailoredResumeId, ""),
    onSuccess: (newCoverLetter) => navigate(`/cover-letters/${newCoverLetter.id}`),
  });
  const downloadMutation = useMutation({
    mutationFn: (fileFormat: "pdf" | "docx") => downloadResume(tailoredResumeId, fileFormat),
    onError: (downloadError) => toast.error(getErrorMessage(downloadError)),
  });

  if (isLoading) return <LoadingState />;
  if (error || !tailoredResume) return <ErrorState error={error ?? new Error("Tailored CV not found.")} />;

  const reviewWarnings = tailoredResume.tailoring_notes.filter((note) => note.startsWith("Please check"));
  const changeNotes = tailoredResume.tailoring_notes.filter((note) => !note.startsWith("Please check"));
  const scoreImprovement = scoreBefore && scoreAfter ? scoreAfter.total_score - scoreBefore.total_score : null;

  return (
    <div className="space-y-6">
      <Link to={`/jobs/${jobId}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back to job
      </Link>

      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[var(--shadow-card)] sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="min-w-0">
            <div className="text-sm font-medium text-brand-600">Tailored CV ready</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{job ? `${job.title} at ${job.company}` : tailoredResume.title}</h1>
            <p className="mt-1 text-sm text-slate-500">Saved as a new CV. Your original is unchanged.</p>
          </div>
          <div className="flex items-center gap-4">
            {scoreBefore ? <ScoreRing score={scoreBefore.total_score} size={84} label="Before" /> : <div className="h-[84px] w-[84px]" />}
            <ArrowRight className="h-6 w-6 text-slate-300" />
            {scoreAfter ? <ScoreRing score={scoreAfter.total_score} size={104} label="After" /> : <div className="h-[104px] w-[104px]" />}
            {scoreImprovement !== null && (
              <div className={`rounded-xl px-3 py-2 text-center ${scoreImprovement >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                <div className="text-xl font-bold">{scoreImprovement >= 0 ? "+" : ""}{scoreImprovement}</div>
                <div className="text-xs font-medium">points</div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link to={`/resumes/${tailoredResumeId}`}><Button><PencilLine className="h-4 w-4" /> Review and edit</Button></Link>
          <Button variant="outline" isLoading={downloadMutation.isPending} onClick={() => downloadMutation.mutate("pdf")}><Download className="h-4 w-4" /> PDF</Button>
          <Button variant="outline" isLoading={downloadMutation.isPending} onClick={() => downloadMutation.mutate("docx")}>Word</Button>
          <Button variant="secondary" isLoading={coverLetterMutation.isPending} onClick={() => coverLetterMutation.mutate()}>
            {!coverLetterMutation.isPending && <Mail className="h-4 w-4" />} Write cover letter
          </Button>
          {job && (job.apply_url || job.job_url) && (
            <a href={job.apply_url || job.job_url || "#"} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium text-slate-600 hover:bg-slate-100">
              <ExternalLink className="h-4 w-4" /> Open job posting
            </a>
          )}
        </div>
        {coverLetterMutation.isPending && <WorkingBanner message="Writing your cover letter…" />}
        {coverLetterMutation.error && <ErrorState error={coverLetterMutation.error} className="mt-4" />}
      </div>

      {reviewWarnings.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="mb-2 flex items-center gap-2 font-semibold text-amber-900"><AlertTriangle className="h-4 w-4" /> Please double-check</div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900/90">
            {reviewWarnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      )}

      {changeNotes.length > 0 && (
        <Card>
          <CardHeader title="What changed" icon={<CheckCircle2 className="h-4 w-4" />} />
          <CardBody>
            <ul className="space-y-2 text-sm text-slate-700">
              {changeNotes.map((note) => (
                <li key={note} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{note}</li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {originalResume && <ResumeComparison originalContent={originalResume.content} tailoredContent={tailoredResume.content} />}
    </div>
  );
}
