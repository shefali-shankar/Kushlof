import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, Download, Save } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

import { downloadCoverLetter, fetchCoverLetter, updateCoverLetter } from "@/api/applications";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState, LoadingState } from "@/components/ui/StatusDisplays";
import { getErrorMessage } from "@/lib/formatters";
import type { CoverLetter } from "@/types/application";

export default function CoverLetterPage() {
  const coverLetterId = Number(useParams().coverLetterId);
  const { data: coverLetter, isLoading, error } = useQuery({ queryKey: ["cover-letter", coverLetterId], queryFn: () => fetchCoverLetter(coverLetterId) });

  if (isLoading) return <LoadingState />;
  if (error || !coverLetter) return <ErrorState error={error ?? new Error("Cover letter not found.")} />;
  return <CoverLetterEditor key={coverLetterId} coverLetter={coverLetter} />;
}

function CoverLetterEditor({ coverLetter }: { coverLetter: CoverLetter }) {
  const queryClient = useQueryClient();
  const [letterBody, setLetterBody] = useState(coverLetter.body);
  const hasUnsavedChanges = letterBody !== coverLetter.body;

  const saveMutation = useMutation({
    mutationFn: () => updateCoverLetter(coverLetter.id, letterBody),
    onSuccess: (savedLetter) => {
      queryClient.setQueryData(["cover-letter", coverLetter.id], savedLetter);
      toast.success("Cover letter saved.");
    },
    onError: (saveError) => toast.error(getErrorMessage(saveError)),
  });

  async function handleDownload(fileFormat: "pdf" | "docx") {
    try {
      if (hasUnsavedChanges) await saveMutation.mutateAsync();
      await downloadCoverLetter(coverLetter.id, fileFormat);
    } catch (downloadError) {
      toast.error(getErrorMessage(downloadError));
    }
  }

  const wordCount = letterBody.split(/\s+/).filter(Boolean).length;

  return (
    <div className="mx-auto max-w-4xl">
      <Link to={`/jobs/${coverLetter.job_id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back to job
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-brand-600">Cover letter</div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{coverLetter.job_title}{coverLetter.company ? ` at ${coverLetter.company}` : ""}</h1>
          <p className="mt-1 text-sm text-slate-500">{wordCount} words · {hasUnsavedChanges ? <span className="text-amber-600">Unsaved changes</span> : "Saved"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigator.clipboard.writeText(letterBody).then(() => toast.success("Copied to clipboard."))}>
            <Copy className="h-4 w-4" /> Copy
          </Button>
          <Button variant="outline" onClick={() => handleDownload("docx")}>Word</Button>
          <Button variant="outline" onClick={() => handleDownload("pdf")}><Download className="h-4 w-4" /> PDF</Button>
          <Button isLoading={saveMutation.isPending} disabled={!hasUnsavedChanges} onClick={() => saveMutation.mutate()}>
            {!saveMutation.isPending && <Save className="h-4 w-4" />} Save
          </Button>
        </div>
      </div>
      <Card className="p-2 sm:p-4">
        <textarea
          value={letterBody}
          onChange={(changeEvent) => setLetterBody(changeEvent.target.value)}
          className="min-h-[70dvh] w-full resize-y rounded-xl border-0 bg-white p-4 font-serif text-[15px] leading-7 text-slate-800 focus:ring-2 focus:ring-brand-500/20 focus:outline-none sm:p-8"
          aria-label="Cover letter text"
        />
      </Card>
    </div>
  );
}
