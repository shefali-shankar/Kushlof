import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, Eye, Gauge, PencilLine, Save, Search, Target } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { downloadResume, fetchResume, updateResume } from "@/api/resumes";
import { AtsScorePanel } from "@/components/resume/AtsScorePanel";
import { ResumePreview } from "@/components/resume/ResumePreview";
import { ResumeEditor, SECTIONS_WITH_AI_REWRITE } from "@/components/resume/ResumeSectionEditors";
import { SectionRewriteDialog } from "@/components/resume/SectionRewriteDialog";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SelectInput } from "@/components/ui/FormFields";
import { ErrorState, LoadingState } from "@/components/ui/StatusDisplays";
import { cn } from "@/lib/classNames";
import { getErrorMessage } from "@/lib/formatters";
import type { ResumeContent, ResumeDetail, ResumeSectionName, ResumeTemplateName, SuggestionSection } from "@/types/resume";

type StudioPanel = "edit" | "score" | "preview";

// Loads the CV, then shows the studio. The `key` gives each CV its own fresh editing state.
export default function ResumeStudioPage() {
  const resumeId = Number(useParams().resumeId);
  const { data: savedResume, isLoading, error } = useQuery({ queryKey: ["resume", resumeId], queryFn: () => fetchResume(resumeId) });

  if (isLoading) return <LoadingState />;
  if (error || !savedResume) return <ErrorState error={error ?? new Error("CV not found.")} />;
  return <ResumeStudio key={resumeId} savedResume={savedResume} />;
}

function ResumeStudio({ savedResume }: { savedResume: ResumeDetail }) {
  const resumeId = savedResume.id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [draftContent, setDraftContent] = useState<ResumeContent>(savedResume.content);
  const [draftTitle, setDraftTitle] = useState(savedResume.title);
  const [templateName, setTemplateName] = useState<ResumeTemplateName>(savedResume.template_name);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [highlightedSection, setHighlightedSection] = useState<SuggestionSection | null>(null);
  const [sectionBeingRewritten, setSectionBeingRewritten] = useState<ResumeSectionName | null>(null);
  const [scoringJobId, setScoringJobId] = useState<number | null>(savedResume.tailored_for_job_id);
  const [activeMobilePanel, setActiveMobilePanel] = useState<StudioPanel>("edit");
  const [isDownloading, setIsDownloading] = useState(false);

  // Warn before leaving the page with unsaved edits.
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warnBeforeUnload = (unloadEvent: BeforeUnloadEvent) => unloadEvent.preventDefault();
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedChanges]);

  const saveMutation = useMutation({
    mutationFn: () => updateResume(resumeId, { title: draftTitle, content: draftContent, template_name: templateName }),
    onSuccess: (updatedResume) => {
      queryClient.setQueryData(["resume", resumeId], updatedResume);
      queryClient.invalidateQueries({ queryKey: ["resumes"] });
      setHasUnsavedChanges(false);
      toast.success("CV saved.");
    },
    onError: (saveError) => toast.error(getErrorMessage(saveError)),
  });

  function changeDraft(updatedContent: ResumeContent) {
    setDraftContent(updatedContent);
    setHasUnsavedChanges(true);
  }

  function goToSection(section: SuggestionSection) {
    const targetSection = section === "general" ? "basics" : section;
    setActiveMobilePanel("edit");
    setHighlightedSection(targetSection);
    window.setTimeout(() => document.getElementById(`resume-section-${targetSection}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    window.setTimeout(() => setHighlightedSection(null), 2500);
  }

  async function openSectionRewrite(section: ResumeSectionName) {
    // The AI works from the saved CV, so save any edits first.
    if (hasUnsavedChanges) await saveMutation.mutateAsync();
    setSectionBeingRewritten(section);
  }

  async function handleDownload(fileFormat: "pdf" | "docx") {
    setIsDownloading(true);
    try {
      if (hasUnsavedChanges) await saveMutation.mutateAsync();
      await downloadResume(resumeId, fileFormat);
    } catch (downloadError) {
      toast.error(getErrorMessage(downloadError));
    } finally {
      setIsDownloading(false);
    }
  }

  const mobilePanelTabs: { panel: StudioPanel; label: string; icon: typeof Eye }[] = [
    { panel: "edit", label: "Edit", icon: PencilLine },
    { panel: "score", label: "Score", icon: Gauge },
    { panel: "preview", label: "Preview", icon: Eye },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link to="/resumes" className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-slate-900" aria-label="Back to CVs">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <input
              value={draftTitle}
              onChange={(changeEvent) => { setDraftTitle(changeEvent.target.value); setHasUnsavedChanges(true); }}
              className="w-full max-w-xl truncate rounded-lg border border-transparent bg-transparent px-2 py-1 text-xl font-semibold tracking-tight text-slate-900 hover:border-slate-200 focus:border-brand-400 focus:bg-white focus:outline-none sm:text-2xl"
              aria-label="CV title"
            />
            <div className="flex flex-wrap items-center gap-2 px-2">
              {savedResume.tailored_for_job_id ? (
                <Link to={`/jobs/${savedResume.tailored_for_job_id}`}>
                  <Badge tone="violet"><Target className="h-3 w-3" /> {savedResume.tailored_for_job_title ?? "Tailored CV"}</Badge>
                </Link>
              ) : (
                <Badge tone="brand">Base CV</Badge>
              )}
              {hasUnsavedChanges ? <span className="text-xs text-amber-600">Unsaved changes</span> : <span className="text-xs text-slate-400">All changes saved</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SelectInput
            value={templateName}
            onChange={(changeEvent) => { setTemplateName(changeEvent.target.value as ResumeTemplateName); setHasUnsavedChanges(true); }}
            className="w-36"
            aria-label="Design"
          >
            <option value="classic">Classic design</option>
            <option value="modern">Modern design</option>
          </SelectInput>
          <Button variant="outline" onClick={() => navigate(`/jobs?matchResume=${resumeId}`)}>
            <Search className="h-4 w-4" /> Find jobs
          </Button>
          <Button variant="outline" isLoading={isDownloading} onClick={() => handleDownload("docx")}>Word</Button>
          <Button variant="outline" isLoading={isDownloading} onClick={() => handleDownload("pdf")}>
            {!isDownloading && <Download className="h-4 w-4" />} PDF
          </Button>
          <Button isLoading={saveMutation.isPending} disabled={!hasUnsavedChanges} onClick={() => saveMutation.mutate()}>
            {!saveMutation.isPending && <Save className="h-4 w-4" />} Save
          </Button>
        </div>
      </div>

      {savedResume.tailoring_notes.length > 0 && (
        <details className="mb-6 rounded-2xl border border-violet-200 bg-violet-50/60 px-5 py-3 text-sm">
          <summary className="cursor-pointer font-medium text-violet-900">What changed when this CV was tailored ({savedResume.tailoring_notes.length})</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-violet-900/80">
            {savedResume.tailoring_notes.map((note, noteIndex) => <li key={noteIndex}>{note}</li>)}
          </ul>
        </details>
      )}

      <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-slate-200/60 p-1 xl:hidden">
        {mobilePanelTabs.map(({ panel, label, icon: TabIcon }) => (
          <button
            key={panel}
            onClick={() => setActiveMobilePanel(panel)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium",
              activeMobilePanel === panel ? "bg-white text-slate-900 shadow-sm" : "text-slate-500",
            )}
          >
            <TabIcon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className={cn("space-y-6", activeMobilePanel === "preview" && "hidden xl:block")}>
          <div className={cn(activeMobilePanel !== "edit" && "hidden xl:block")}>
            <ResumeEditor
              content={draftContent}
              onContentChange={changeDraft}
              highlightedSection={highlightedSection}
              onImproveSection={(section) => SECTIONS_WITH_AI_REWRITE.includes(section) && openSectionRewrite(section)}
            />
          </div>
          <div className={cn(activeMobilePanel !== "score" && "hidden", "xl:hidden")}>
            <AtsScorePanel
              resumeId={resumeId}
              selectedJobId={scoringJobId}
              onSelectedJobChange={setScoringJobId}
              onGoToSection={goToSection}
              hasUnsavedChanges={hasUnsavedChanges}
              savedVersionTimestamp={savedResume.updated_at}
            />
          </div>
        </div>

        <div className={cn("space-y-6", activeMobilePanel === "edit" && "hidden xl:block", activeMobilePanel === "score" && "hidden xl:block")}>
          <div className="xl:sticky xl:top-6 space-y-6">
            <ResumePreview content={draftContent} templateName={templateName} />
            <div className="hidden xl:block">
              <AtsScorePanel
                resumeId={resumeId}
                selectedJobId={scoringJobId}
                onSelectedJobChange={setScoringJobId}
                onGoToSection={goToSection}
                hasUnsavedChanges={hasUnsavedChanges}
                savedVersionTimestamp={savedResume.updated_at}
              />
            </div>
          </div>
        </div>
      </div>

      <SectionRewriteDialog
        resumeId={resumeId}
        section={sectionBeingRewritten}
        targetJobId={scoringJobId}
        onClose={() => setSectionBeingRewritten(null)}
        onAccept={(section, proposedValue) => {
          changeDraft({ ...draftContent, [section]: proposedValue } as ResumeContent);
          toast.success("Changes applied to your draft. Remember to save.");
        }}
      />
    </div>
  );
}
