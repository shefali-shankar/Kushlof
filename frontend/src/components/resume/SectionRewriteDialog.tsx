import { useMutation } from "@tanstack/react-query";
import { Check, Sparkles } from "lucide-react";
import { useState } from "react";

import { requestSectionRewrite } from "@/api/resumes";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, TextArea } from "@/components/ui/FormFields";
import { ErrorState, WorkingBanner } from "@/components/ui/StatusDisplays";
import type { ResumeSectionName } from "@/types/resume";

import { SectionValueView } from "./SectionValueView";

const QUICK_INSTRUCTIONS: Record<ResumeSectionName, string[]> = {
  summary: ["Make it more concise and impactful", "Target the selected job", "Highlight leadership and results"],
  work: ["Start every bullet with a strong action verb", "Make achievements more results-focused", "Tighten wording; remove filler", "Use the selected job's keywords where they truly apply"],
  skills: ["Group skills into clear categories", "Put the most relevant skills first"],
  projects: ["Emphasise impact and technologies used", "Make descriptions more concise"],
  education: [],
  certifications: [],
};

const SECTION_TITLES: Record<ResumeSectionName, string> = {
  summary: "summary",
  work: "work experience",
  skills: "skills",
  projects: "projects",
  education: "education",
  certifications: "certifications",
};

interface SectionRewriteDialogProperties {
  resumeId: number;
  section: ResumeSectionName | null;
  targetJobId: number | null;
  onClose: () => void;
  onAccept: (section: ResumeSectionName, proposedValue: unknown) => void;
}

// Ask the AI to rewrite one section, compare before/after, then accept or discard the change.
export function SectionRewriteDialog({ resumeId, section, targetJobId, onClose, onAccept }: SectionRewriteDialogProperties) {
  const [instruction, setInstruction] = useState("");
  const rewriteMutation = useMutation({
    mutationFn: () => requestSectionRewrite(resumeId, section!, instruction, targetJobId),
  });

  function closeAndReset() {
    setInstruction("");
    rewriteMutation.reset();
    onClose();
  }

  if (!section) return null;
  const rewriteResult = rewriteMutation.data;

  return (
    <Dialog
      isOpen={section !== null}
      onClose={closeAndReset}
      size="xl"
      title={`Improve your ${SECTION_TITLES[section]} with AI`}
      description="The AI only rephrases and reorders what's already in your CV — it never invents facts. Changes are applied to your draft only after you accept them."
      footer={
        rewriteResult ? (
          <>
            <Button variant="outline" onClick={() => rewriteMutation.reset()}>Try different instructions</Button>
            <Button
              onClick={() => {
                onAccept(section, rewriteResult.proposed_value);
                closeAndReset();
              }}
            >
              <Check className="h-4 w-4" /> Accept changes
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={closeAndReset}>Cancel</Button>
            <Button isLoading={rewriteMutation.isPending} disabled={!instruction.trim()} onClick={() => rewriteMutation.mutate()}>
              {!rewriteMutation.isPending && <Sparkles className="h-4 w-4" />} Generate
            </Button>
          </>
        )
      }
    >
      {!rewriteResult && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {QUICK_INSTRUCTIONS[section].map((quickInstruction) => (
              <button
                key={quickInstruction}
                type="button"
                onClick={() => setInstruction(quickInstruction)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-brand-300 hover:bg-brand-50"
              >
                {quickInstruction}
              </button>
            ))}
          </div>
          <Field label="Your instructions" hint={targetJobId ? "The selected job in the score panel will be used as the target." : "Tip: select a job in the score panel to tailor towards it."}>
            <TextArea rows={3} value={instruction} placeholder="e.g. Make the bullets more results-focused and mention stakeholder management" onChange={(changeEvent) => setInstruction(changeEvent.target.value)} />
          </Field>
          {rewriteMutation.isPending && <WorkingBanner message="Rewriting… local models can take a minute or two." />}
          {rewriteMutation.error && <ErrorState error={rewriteMutation.error} />}
        </div>
      )}

      {rewriteResult && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">Current</div>
            <SectionValueView section={section} value={rewriteResult.original_value} />
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <div className="mb-3 text-xs font-semibold tracking-wide text-emerald-700 uppercase">Proposed</div>
            <SectionValueView section={section} value={rewriteResult.proposed_value} />
          </div>
        </div>
      )}
    </Dialog>
  );
}
