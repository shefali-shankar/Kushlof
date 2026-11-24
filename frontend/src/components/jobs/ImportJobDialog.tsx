import { useMutation } from "@tanstack/react-query";
import { ClipboardPaste, Link2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { importJob } from "@/api/jobs";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, TextArea, TextInput } from "@/components/ui/FormFields";
import { ErrorState, WorkingBanner } from "@/components/ui/StatusDisplays";
import { cn } from "@/lib/classNames";

type ImportMethod = "link" | "text";

// Import one job from a pasted link (LinkedIn or any job page), or from pasted description text.
export function ImportJobDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [importMethod, setImportMethod] = useState<ImportMethod>("link");
  const [jobLink, setJobLink] = useState("");
  const [pastedDescription, setPastedDescription] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");

  const importMutation = useMutation({
    mutationFn: () =>
      importJob(
        importMethod === "link"
          ? { url: jobLink.trim() }
          : { pasted_description: pastedDescription, title: jobTitle || undefined, company: companyName || undefined },
      ),
    onSuccess: (importedJob) => {
      toast.success("Job imported.");
      onClose();
      navigate(`/jobs/${importedJob.id}`);
    },
  });

  const canSubmit = importMethod === "link" ? /^https?:\/\/\S+/.test(jobLink.trim()) : pastedDescription.trim().length > 100;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title="Import a job"
      description="Paste a LinkedIn, Seek, Indeed or company careers link. If the site blocks it, paste the description instead."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button isLoading={importMutation.isPending} disabled={!canSubmit} onClick={() => importMutation.mutate()}>Import job</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          {([["link", "Paste a link", Link2], ["text", "Paste the description", ClipboardPaste]] as const).map(([method, label, MethodIcon]) => (
            <button
              key={method}
              type="button"
              onClick={() => setImportMethod(method)}
              className={cn("flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium", importMethod === method ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}
            >
              <MethodIcon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        {importMethod === "link" ? (
          <Field label="Job link">
            <TextInput type="url" value={jobLink} placeholder="https://www.linkedin.com/jobs/view/..." onChange={(changeEvent) => setJobLink(changeEvent.target.value)} autoFocus />
          </Field>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Job title (optional)">
                <TextInput value={jobTitle} onChange={(changeEvent) => setJobTitle(changeEvent.target.value)} />
              </Field>
              <Field label="Company (optional)">
                <TextInput value={companyName} onChange={(changeEvent) => setCompanyName(changeEvent.target.value)} />
              </Field>
            </div>
            <Field label="Job description" hint="If you leave the title or company empty, the AI will fill them in.">
              <TextArea rows={10} value={pastedDescription} placeholder="Paste the full job description here…" onChange={(changeEvent) => setPastedDescription(changeEvent.target.value)} />
            </Field>
          </>
        )}
        {importMutation.isPending && <WorkingBanner message="Reading the job…" />}
        {importMutation.error && <ErrorState error={importMutation.error} />}
      </div>
    </Dialog>
  );
}
