import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookmarkPlus,
  Building2,
  Download,
  ExternalLink,
  FileText,
  ListChecks,
  Mail,
  MapPin,
  Sparkles,
  Target,
  Trash2,
  Wand2,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { addJobToBoard, fetchCoverLetters, generateCoverLetter } from "@/api/applications";
import { analyzeJob, deleteJob, fetchJob, loadJobDescription, tailorResumeForJob, updateJobDescription } from "@/api/jobs";
import { fetchResumes } from "@/api/resumes";
import { STATUS_BADGE_TONES } from "@/components/board/applicationStatusStyles";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Field, SelectInput, TextArea } from "@/components/ui/FormFields";
import { ErrorState, LoadingState, WorkingBanner } from "@/components/ui/StatusDisplays";
import { formatJobSource, formatRelativeDate, getErrorMessage } from "@/lib/formatters";
import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/types/application";
import type { JobDetail, JobRequirements } from "@/types/job";

function RequirementsCard({ requirements }: { requirements: JobRequirements }) {
  const skillGroups = [
    { label: "Required skills", skills: requirements.required_skills, tone: "brand" as const },
    { label: "Nice to have", skills: requirements.preferred_skills, tone: "gray" as const },
    { label: "ATS keywords", skills: requirements.ats_keywords, tone: "violet" as const },
  ];
  return (
    <Card>
      <CardHeader title="What they're looking for" icon={<ListChecks className="h-4 w-4" />} description={requirements.seniority ? `Seniority: ${requirements.seniority}` : undefined} />
      <CardBody className="space-y-4">
        {skillGroups.map(({ label, skills, tone }) =>
          skills.length ? (
            <div key={label}>
              <div className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</div>
              <div className="flex flex-wrap gap-1.5">{skills.map((skill) => <Badge key={skill} tone={tone}>{skill}</Badge>)}</div>
            </div>
          ) : null,
        )}
        {requirements.responsibilities.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Key responsibilities</div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              {requirements.responsibilities.map((responsibility) => <li key={responsibility}>{responsibility}</li>)}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

const MINIMUM_PASTED_DESCRIPTION_LENGTH = 50;

function MissingDescriptionPanel({ jobId, isFromLinkedIn }: { jobId: number; isFromLinkedIn: boolean }) {
  const queryClient = useQueryClient();
  const [pastedDescription, setPastedDescription] = useState("");
  const showUpdatedJob = (updatedJob: JobDetail) => {
    queryClient.setQueryData(["job", jobId], updatedJob);
    toast.success("Job description added.");
  };

  const loadFromLinkedInMutation = useMutation({
    mutationFn: () => loadJobDescription(jobId),
    onSuccess: showUpdatedJob,
    onError: (loadError) => toast.error(getErrorMessage(loadError)),
  });
  const savePastedDescriptionMutation = useMutation({
    mutationFn: () => updateJobDescription(jobId, pastedDescription),
    onSuccess: showUpdatedJob,
    onError: (saveError) => toast.error(getErrorMessage(saveError)),
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        {isFromLinkedIn
          ? "LinkedIn search results are saved without their description, so your connection doesn't get rate-limited. Load it now, or paste it from the posting."
          : "This job has no description. Paste it from the job posting so Kushlof can analyse it and tailor your CV."}
      </p>
      {isFromLinkedIn && (
        <Button variant="secondary" isLoading={loadFromLinkedInMutation.isPending} onClick={() => loadFromLinkedInMutation.mutate()}>
          <Download className="h-4 w-4" /> Load description from LinkedIn
        </Button>
      )}
      <Field label="Or paste the job description">
        <TextArea rows={6} value={pastedDescription} onChange={(changeEvent) => setPastedDescription(changeEvent.target.value)} />
      </Field>
      <Button
        variant="outline"
        disabled={pastedDescription.trim().length < MINIMUM_PASTED_DESCRIPTION_LENGTH}
        isLoading={savePastedDescriptionMutation.isPending}
        onClick={() => savePastedDescriptionMutation.mutate()}
      >
        Save description
      </Button>
    </div>
  );
}

export default function JobDetailsPage() {
  const jobId = Number(useParams().jobId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isTailorDialogOpen, setIsTailorDialogOpen] = useState(false);
  const [isCoverLetterDialogOpen, setIsCoverLetterDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [chosenResumeId, setChosenResumeId] = useState<number | null>(null);
  const [coverLetterInstructions, setCoverLetterInstructions] = useState("");

  const { data: job, isLoading, error } = useQuery({ queryKey: ["job", jobId], queryFn: () => fetchJob(jobId) });
  const { data: resumes = [] } = useQuery({ queryKey: ["resumes"], queryFn: fetchResumes });
  const { data: coverLetters = [] } = useQuery({ queryKey: ["cover-letters", jobId], queryFn: () => fetchCoverLetters(jobId) });

  const baseResumes = resumes.filter((resume) => !resume.tailored_for_job_id);
  const tailoredResumesForThisJob = resumes.filter((resume) => resume.tailored_for_job_id === jobId);
  const selectedResumeId = chosenResumeId ?? baseResumes[0]?.id ?? null;
  const refreshJob = () => queryClient.invalidateQueries({ queryKey: ["job", jobId] });

  const analyzeMutation = useMutation({
    mutationFn: () => analyzeJob(jobId),
    onSuccess: (analysedJob) => { queryClient.setQueryData(["job", jobId], analysedJob); toast.success("Job analysed."); },
    onError: (analyzeError) => toast.error(getErrorMessage(analyzeError)),
  });
  const saveToBoardMutation = useMutation({
    mutationFn: () => addJobToBoard(jobId),
    onSuccess: () => { refreshJob(); toast.success("Added to your board."); },
    onError: (saveError) => toast.error(getErrorMessage(saveError)),
  });
  const tailorMutation = useMutation({
    mutationFn: () => tailorResumeForJob(jobId, selectedResumeId!),
    onSuccess: (tailoringResult) => {
      queryClient.invalidateQueries({ queryKey: ["resumes"] });
      refreshJob();
      navigate(`/jobs/${jobId}/tailored/${tailoringResult.tailored_resume_id}`, { state: tailoringResult });
    },
  });
  const coverLetterMutation = useMutation({
    mutationFn: () => generateCoverLetter(jobId, selectedResumeId!, coverLetterInstructions),
    onSuccess: (newCoverLetter) => {
      queryClient.invalidateQueries({ queryKey: ["cover-letters", jobId] });
      navigate(`/cover-letters/${newCoverLetter.id}`);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteJob(jobId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["jobs"] }); toast.success("Job deleted."); navigate("/jobs"); },
    onError: (deleteError) => toast.error(getErrorMessage(deleteError)),
  });

  if (isLoading) return <LoadingState />;
  if (error || !job) return <ErrorState error={error ?? new Error("Job not found.")} />;

  const resumePicker = (
    <Field label="Start from this CV">
      <SelectInput value={selectedResumeId ?? ""} onChange={(changeEvent) => setChosenResumeId(Number(changeEvent.target.value))}>
        {resumes.map((resume) => (
          <option key={resume.id} value={resume.id}>
            {resume.title}{resume.tailored_for_job_id ? " (tailored)" : ""}
          </option>
        ))}
      </SelectInput>
    </Field>
  );

  return (
    <div>
      <Link to="/jobs" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> All jobs
      </Link>

      <div className="mb-6 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[var(--shadow-card)] sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge tone="gray">{formatJobSource(job.source)}</Badge>
              {job.application_status && (
                <Badge tone={STATUS_BADGE_TONES[job.application_status as ApplicationStatus]}>
                  {APPLICATION_STATUS_LABELS[job.application_status as ApplicationStatus]}
                </Badge>
              )}
              {job.is_remote && <Badge tone="green">Remote</Badge>}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{job.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5"><Building2 className="h-4 w-4" />{job.company || "Unknown company"}</span>
              {job.location && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{job.location}</span>}
              {job.salary && <span className="font-medium text-emerald-700">{job.salary}</span>}
              <span>Added {formatRelativeDate(job.created_at)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(job.apply_url || job.job_url) && (
              <a href={job.apply_url || job.job_url || "#"} target="_blank" rel="noopener noreferrer">
                <Button variant="outline"><ExternalLink className="h-4 w-4" /> Open posting</Button>
              </a>
            )}
            {!job.application_id && (
              <Button variant="outline" isLoading={saveToBoardMutation.isPending} onClick={() => saveToBoardMutation.mutate()}>
                <BookmarkPlus className="h-4 w-4" /> Save to board
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => setIsDeleteDialogOpen(true)} aria-label="Delete job"><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button onClick={() => setIsTailorDialogOpen(true)} className="group flex items-center gap-4 rounded-2xl bg-gradient-to-br from-brand-600 to-violet-600 p-4 text-left text-white shadow-lg shadow-brand-600/20 transition hover:brightness-110">
            <div className="rounded-xl bg-white/15 p-2.5"><Wand2 className="h-5 w-5" /></div>
            <div>
              <div className="font-semibold">Tailor my CV to this job</div>
              <div className="text-sm text-brand-100">Higher ATS score, no invented facts</div>
            </div>
          </button>
          <button onClick={() => setIsCoverLetterDialogOpen(true)} className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-brand-300 hover:bg-brand-50/40">
            <div className="rounded-xl bg-brand-50 p-2.5 text-brand-600"><Mail className="h-5 w-5" /></div>
            <div>
              <div className="font-semibold text-slate-900">Write a cover letter</div>
              <div className="text-sm text-slate-500">Specific to this role and company</div>
            </div>
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Job description" icon={<FileText className="h-4 w-4" />} />
          <CardBody>
            {job.description.trim() ? (
              <div className="max-w-none text-sm leading-relaxed whitespace-pre-line text-slate-700">{job.description}</div>
            ) : (
              <MissingDescriptionPanel jobId={jobId} isFromLinkedIn={(job.job_url ?? "").includes("linkedin.com/jobs/view/")} />
            )}
          </CardBody>
        </Card>

        <div className="space-y-6">
          {job.requirements ? (
            <RequirementsCard requirements={job.requirements} />
          ) : (
            <Card>
              <CardBody className="space-y-3 text-center">
                <Sparkles className="mx-auto h-6 w-6 text-brand-500" />
                <p className="text-sm text-slate-600">Let the AI pull out the skills and ATS keywords this job asks for.</p>
                <Button variant="secondary" isLoading={analyzeMutation.isPending} onClick={() => analyzeMutation.mutate()}>Analyse job</Button>
              </CardBody>
            </Card>
          )}

          {(tailoredResumesForThisJob.length > 0 || coverLetters.length > 0) && (
            <Card>
              <CardHeader title="Your documents for this job" icon={<Target className="h-4 w-4" />} />
              <ul className="divide-y divide-slate-100">
                {tailoredResumesForThisJob.map((resume) => (
                  <li key={`resume-${resume.id}`}>
                    <Link to={`/resumes/${resume.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-slate-50">
                      <FileText className="h-4 w-4 text-brand-500" />
                      <span className="flex-1 truncate font-medium text-slate-800">{resume.title}</span>
                      <span className="text-xs text-slate-400">{formatRelativeDate(resume.updated_at)}</span>
                    </Link>
                  </li>
                ))}
                {coverLetters.map((coverLetter) => (
                  <li key={`letter-${coverLetter.id}`}>
                    <Link to={`/cover-letters/${coverLetter.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-slate-50">
                      <Mail className="h-4 w-4 text-violet-500" />
                      <span className="flex-1 truncate font-medium text-slate-800">Cover letter</span>
                      <span className="text-xs text-slate-400">{formatRelativeDate(coverLetter.updated_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <Dialog
        isOpen={isTailorDialogOpen}
        onClose={() => !tailorMutation.isPending && setIsTailorDialogOpen(false)}
        title="Tailor your CV to this job"
        description="Kushlof creates a new copy of your CV for this job. Your original stays unchanged."
        footer={
          <>
            <Button variant="outline" disabled={tailorMutation.isPending} onClick={() => setIsTailorDialogOpen(false)}>Cancel</Button>
            <Button isLoading={tailorMutation.isPending} disabled={!selectedResumeId} onClick={() => tailorMutation.mutate()}>
              {!tailorMutation.isPending && <Wand2 className="h-4 w-4" />} Tailor CV
            </Button>
          </>
        }
      >
        {resumes.length === 0 ? (
          <p className="text-sm text-slate-600">Upload a CV first on the <Link to="/resumes" className="font-medium text-brand-600">My CVs</Link> page.</p>
        ) : (
          <div className="space-y-4">
            {resumePicker}
            {tailorMutation.isPending && <WorkingBanner message="Analysing the job and tailoring your CV… this can take a minute or two." />}
            {tailorMutation.error && <ErrorState error={tailorMutation.error} />}
          </div>
        )}
      </Dialog>

      <Dialog
        isOpen={isCoverLetterDialogOpen}
        onClose={() => !coverLetterMutation.isPending && setIsCoverLetterDialogOpen(false)}
        title="Write a cover letter"
        footer={
          <>
            <Button variant="outline" disabled={coverLetterMutation.isPending} onClick={() => setIsCoverLetterDialogOpen(false)}>Cancel</Button>
            <Button isLoading={coverLetterMutation.isPending} disabled={!selectedResumeId} onClick={() => coverLetterMutation.mutate()}>
              {!coverLetterMutation.isPending && <Sparkles className="h-4 w-4" />} Write letter
            </Button>
          </>
        }
      >
        {resumes.length === 0 ? (
          <p className="text-sm text-slate-600">Upload a CV first on the <Link to="/resumes" className="font-medium text-brand-600">My CVs</Link> page.</p>
        ) : (
          <div className="space-y-4">
            {resumePicker}
            <Field label="Anything to mention? (optional)" hint="e.g. I'm relocating to Melbourne in March; mention my volunteering at the food bank.">
              <TextArea rows={3} value={coverLetterInstructions} onChange={(changeEvent) => setCoverLetterInstructions(changeEvent.target.value)} />
            </Field>
            {coverLetterMutation.isPending && <WorkingBanner message="Writing your cover letter…" />}
            {coverLetterMutation.error && <ErrorState error={coverLetterMutation.error} />}
          </div>
        )}
      </Dialog>

      <Dialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        title="Delete this job?"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="danger" isLoading={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>Delete</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">The job, its board card and cover letters will be deleted. Tailored CVs are kept.</p>
      </Dialog>
    </div>
  );
}
