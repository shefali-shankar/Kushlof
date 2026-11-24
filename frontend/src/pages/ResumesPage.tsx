import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, FilePlus2, FileText, MoreHorizontal, Target, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { createBlankResume, deleteResume, duplicateResume, fetchResumes, uploadResume } from "@/api/resumes";
import { ResumeUploadDropzone } from "@/components/resume/ResumeUploadDropzone";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState, LoadingState } from "@/components/ui/StatusDisplays";
import { formatRelativeDate, getErrorMessage } from "@/lib/formatters";
import type { ResumeSummary } from "@/types/resume";

function ResumeCard({ resume, onDuplicate, onDelete }: { resume: ResumeSummary; onDuplicate: () => void; onDelete: () => void }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  return (
    <Card className="group relative flex flex-col transition hover:-translate-y-0.5 hover:shadow-md">
      <Link to={`/resumes/${resume.id}`} className="flex flex-1 flex-col p-5">
        <div className="mb-4 flex h-28 items-center justify-center rounded-xl bg-gradient-to-br from-slate-50 to-brand-50/60 ring-1 ring-slate-100">
          <div className="w-16 space-y-1.5 rounded-md bg-white p-2 shadow-sm">
            <div className="h-1.5 w-8 rounded bg-slate-700" />
            <div className="h-1 w-12 rounded bg-brand-300" />
            <div className="h-1 w-full rounded bg-slate-200" />
            <div className="h-1 w-full rounded bg-slate-200" />
            <div className="h-1 w-10 rounded bg-slate-200" />
          </div>
        </div>
        <div className="truncate font-semibold text-slate-900">{resume.title}</div>
        <div className="mt-0.5 truncate text-sm text-slate-500">{resume.candidate_name || "No name yet"}</div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {resume.tailored_for_job_id ? (
            <Badge tone="violet">
              <Target className="h-3 w-3" /> Tailored
            </Badge>
          ) : (
            <Badge tone="brand">Base CV</Badge>
          )}
          <Badge tone="gray">{resume.template_name}</Badge>
        </div>
        {resume.tailored_for_job_title && <div className="mt-2 truncate text-xs text-slate-500">For {resume.tailored_for_job_title}</div>}
        <div className="mt-auto pt-3 text-xs text-slate-400">Edited {formatRelativeDate(resume.updated_at)}</div>
      </Link>
      <div className="absolute top-3 right-3">
        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="rounded-lg bg-white/80 p-1.5 text-slate-500 shadow-sm hover:text-slate-900" aria-label="CV actions">
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {isMenuOpen && (
          <div className="absolute right-0 z-10 mt-1 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg" onMouseLeave={() => setIsMenuOpen(false)}>
            <button onClick={() => { setIsMenuOpen(false); onDuplicate(); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <Copy className="h-4 w-4" /> Duplicate
            </button>
            <button onClick={() => { setIsMenuOpen(false); onDelete(); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function ResumesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [resumePendingDeletion, setResumePendingDeletion] = useState<ResumeSummary | null>(null);
  const { data: resumes, isLoading, error } = useQuery({ queryKey: ["resumes"], queryFn: fetchResumes });

  const refreshResumeList = () => queryClient.invalidateQueries({ queryKey: ["resumes"] });

  const uploadMutation = useMutation({
    mutationFn: uploadResume,
    onSuccess: (uploadedResume) => {
      toast.success("CV imported. Review each section to check it was read correctly.");
      refreshResumeList();
      navigate(`/resumes/${uploadedResume.id}`);
    },
    onError: (uploadError) => toast.error(getErrorMessage(uploadError)),
  });
  const createBlankMutation = useMutation({
    mutationFn: () => createBlankResume("My CV"),
    onSuccess: (newResume) => navigate(`/resumes/${newResume.id}`),
    onError: (createError) => toast.error(getErrorMessage(createError)),
  });
  const duplicateMutation = useMutation({
    mutationFn: duplicateResume,
    onSuccess: () => { toast.success("Copy created."); refreshResumeList(); },
    onError: (duplicateError) => toast.error(getErrorMessage(duplicateError)),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteResume,
    onSuccess: () => { toast.success("CV deleted."); setResumePendingDeletion(null); refreshResumeList(); },
    onError: (deleteError) => toast.error(getErrorMessage(deleteError)),
  });

  const baseResumes = resumes?.filter((resume) => !resume.tailored_for_job_id) ?? [];
  const tailoredResumes = resumes?.filter((resume) => resume.tailored_for_job_id) ?? [];

  return (
    <div>
      <PageHeader
        title="My CVs"
        description="Upload your CV to get an ATS score, improve it section by section, and create tailored versions for each job."
        actions={
          <Button variant="outline" isLoading={createBlankMutation.isPending} onClick={() => createBlankMutation.mutate()}>
            <FilePlus2 className="h-4 w-4" /> Start from scratch
          </Button>
        }
      />

      <ResumeUploadDropzone isUploading={uploadMutation.isPending} onFileSelected={(selectedFile) => uploadMutation.mutate(selectedFile)} />

      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} className="mt-6" />}

      {resumes && resumes.length === 0 && (
        <p className="mt-8 text-center text-sm text-slate-500">
          <FileText className="mx-auto mb-2 h-6 w-6 text-slate-300" />
          No CVs yet — upload one above to get started.
        </p>
      )}

      {[
        { heading: "Base CVs", list: baseResumes },
        { heading: "Tailored for jobs", list: tailoredResumes },
      ].map(({ heading, list }) =>
        list.length ? (
          <section key={heading} className="mt-10">
            <h2 className="mb-4 text-sm font-semibold tracking-wide text-slate-500 uppercase">{heading}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {list.map((resume) => (
                <ResumeCard key={resume.id} resume={resume} onDuplicate={() => duplicateMutation.mutate(resume.id)} onDelete={() => setResumePendingDeletion(resume)} />
              ))}
            </div>
          </section>
        ) : null,
      )}

      <Dialog
        isOpen={resumePendingDeletion !== null}
        onClose={() => setResumePendingDeletion(null)}
        title="Delete this CV?"
        description={resumePendingDeletion?.title}
        footer={
          <>
            <Button variant="outline" onClick={() => setResumePendingDeletion(null)}>Cancel</Button>
            <Button variant="danger" isLoading={deleteMutation.isPending} onClick={() => resumePendingDeletion && deleteMutation.mutate(resumePendingDeletion.id)}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">This cannot be undone. Applications using this CV will be unlinked from it.</p>
      </Dialog>
    </div>
  );
}
