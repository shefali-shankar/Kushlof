import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, ExternalLink, FileText, Mail, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { downloadCoverLetter, fetchApplication, markApplicationAsApplied, removeApplication, updateApplication } from "@/api/applications";
import { downloadResume } from "@/api/resumes";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, SelectInput, TextArea } from "@/components/ui/FormFields";
import { LoadingState } from "@/components/ui/StatusDisplays";
import { formatRelativeDate, getErrorMessage } from "@/lib/formatters";
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_ORDER, type ApplicationDetail, type ApplicationStatus } from "@/types/application";

function ApplicationDetailsContent({ application, onClose }: { application: ApplicationDetail; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(application.notes);
  const refreshBoard = () => {
    queryClient.invalidateQueries({ queryKey: ["applications"] });
    queryClient.invalidateQueries({ queryKey: ["application", application.id] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const updateMutation = useMutation({
    mutationFn: (changes: { status?: ApplicationStatus; notes?: string }) => updateApplication(application.id, changes),
    onSuccess: () => { refreshBoard(); toast.success("Saved."); },
    onError: (updateError) => toast.error(getErrorMessage(updateError)),
  });
  const markAppliedMutation = useMutation({
    mutationFn: () => markApplicationAsApplied(application.id),
    onSuccess: () => { refreshBoard(); toast.success("Marked as applied. Good luck!"); },
  });
  const removeMutation = useMutation({
    mutationFn: () => removeApplication(application.id),
    onSuccess: () => { refreshBoard(); onClose(); toast.success("Removed from board."); },
  });

  const applyLink = application.apply_url || application.job_url;

  async function handleApplyClick() {
    // Open the application page first (browsers block pop-ups opened after a delay), then download the documents.
    if (applyLink) window.open(applyLink, "_blank", "noopener,noreferrer");
    try {
      if (application.resume_id) await downloadResume(application.resume_id, "pdf");
      if (application.cover_letter_id) await downloadCoverLetter(application.cover_letter_id, "pdf");
    } catch (downloadError) {
      toast.error(getErrorMessage(downloadError));
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-brand-50 to-violet-50 p-4">
        <div className="text-sm font-medium text-slate-700">Ready to apply?</div>
        <p className="mt-1 text-xs text-slate-500">Downloads your tailored CV and cover letter, then opens the job's application page. Kushlof never submits for you.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={handleApplyClick} disabled={!applyLink}><Send className="h-4 w-4" /> Apply now</Button>
          {application.status !== "applied" && (
            <Button size="sm" variant="outline" isLoading={markAppliedMutation.isPending} onClick={() => markAppliedMutation.mutate()}>
              <CheckCircle2 className="h-4 w-4" /> I've applied
            </Button>
          )}
        </div>
      </div>

      <Field label="Status">
        <SelectInput value={application.status} onChange={(changeEvent) => updateMutation.mutate({ status: changeEvent.target.value as ApplicationStatus })}>
          {APPLICATION_STATUS_ORDER.map((status) => <option key={status} value={status}>{APPLICATION_STATUS_LABELS[status]}</option>)}
        </SelectInput>
      </Field>

      <div>
        <div className="mb-2 text-sm font-medium text-slate-700">Documents</div>
        <div className="space-y-2">
          {application.resume_id ? (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm">
              <FileText className="h-4 w-4 text-brand-500" />
              <Link to={`/resumes/${application.resume_id}`} className="flex-1 font-medium text-slate-800 hover:text-brand-700">Tailored CV</Link>
              <Button size="sm" variant="ghost" onClick={() => downloadResume(application.resume_id!, "pdf").catch((downloadError) => toast.error(getErrorMessage(downloadError)))}><Download className="h-4 w-4" /></Button>
            </div>
          ) : (
            <Link to={`/jobs/${application.job_id}`} className="block rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-500 hover:border-brand-300 hover:text-brand-700">
              No tailored CV yet — tailor one from the job page →
            </Link>
          )}
          {application.cover_letter_id ? (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm">
              <Mail className="h-4 w-4 text-violet-500" />
              <Link to={`/cover-letters/${application.cover_letter_id}`} className="flex-1 font-medium text-slate-800 hover:text-brand-700">Cover letter</Link>
              <Button size="sm" variant="ghost" onClick={() => downloadCoverLetter(application.cover_letter_id!, "pdf").catch((downloadError) => toast.error(getErrorMessage(downloadError)))}><Download className="h-4 w-4" /></Button>
            </div>
          ) : (
            <Link to={`/jobs/${application.job_id}`} className="block rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-500 hover:border-brand-300 hover:text-brand-700">
              No cover letter yet — write one from the job page →
            </Link>
          )}
        </div>
      </div>

      <Field label="Notes" hint="Contacts, interview dates, follow-ups…">
        <TextArea rows={4} value={notes} onChange={(changeEvent) => setNotes(changeEvent.target.value)} />
      </Field>
      {notes !== application.notes && (
        <Button size="sm" isLoading={updateMutation.isPending} onClick={() => updateMutation.mutate({ notes })}>Save notes</Button>
      )}

      <div>
        <div className="mb-2 text-sm font-medium text-slate-700">History</div>
        <ol className="space-y-2 border-l-2 border-slate-100 pl-4">
          {application.status_history.map((statusChange, changeIndex) => (
            <li key={changeIndex} className="relative text-sm">
              <span className="absolute top-1.5 -left-[21px] h-2.5 w-2.5 rounded-full bg-brand-400" />
              <span className="font-medium text-slate-800">{APPLICATION_STATUS_LABELS[statusChange.to_status as ApplicationStatus] ?? statusChange.to_status}</span>
              <span className="ml-2 text-xs text-slate-400">{formatRelativeDate(statusChange.changed_at)}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-4">
        <Link to={`/jobs/${application.job_id}`}><Button variant="outline" size="sm"><ExternalLink className="h-4 w-4" /> Job details</Button></Link>
        <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700" isLoading={removeMutation.isPending} onClick={() => removeMutation.mutate()}>
          <Trash2 className="h-4 w-4" /> Remove from board
        </Button>
      </div>
    </div>
  );
}

// Slide-over panel with an application's documents, notes, status and history.
export function ApplicationDetailsPanel({ applicationId, onClose }: { applicationId: number | null; onClose: () => void }) {
  const { data: application, isLoading } = useQuery({
    queryKey: ["application", applicationId],
    queryFn: () => fetchApplication(applicationId!),
    enabled: applicationId !== null,
  });

  return (
    <Dialog
      isOpen={applicationId !== null}
      onClose={onClose}
      placement="side"
      title={application?.job_title ?? "Application"}
      description={application ? `${application.company}${application.location ? ` · ${application.location}` : ""}` : undefined}
    >
      {isLoading || !application ? <LoadingState /> : <ApplicationDetailsContent key={application.id} application={application} onClose={onClose} />}
    </Dialog>
  );
}
