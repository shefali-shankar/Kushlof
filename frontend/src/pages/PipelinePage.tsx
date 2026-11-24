import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Hand, Play, Plus, Search, Square, Trash2, Workflow } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { createSavedSearch, deleteSavedSearch, fetchSavedSearches } from "@/api/jobs";
import { fetchResumes } from "@/api/resumes";
import { cancelPipelineRun, fetchPipelineRuns, startPipelineRun } from "@/api/settings";
import { DEFAULT_JOB_SEARCH, JobSearchForm } from "@/components/jobs/JobSearchForm";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Checkbox, Field, SelectInput } from "@/components/ui/FormFields";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/StatusDisplays";
import { cn } from "@/lib/classNames";
import { formatRelativeDate, getErrorMessage } from "@/lib/formatters";
import { JOB_SITE_LABELS, type FetchJobsRequest } from "@/types/job";
import type { PipelineRun } from "@/types/settings";

const RUN_STATUS_TONES = { running: "brand", completed: "green", failed: "red", cancelled: "amber" } as const;

const PIPELINE_STEPS = [
  { title: "Fetch", text: "Runs your saved searches on the job sites" },
  { title: "Match", text: "Scores every job against your CV" },
  { title: "Tailor", text: "Creates tailored CVs for the best matches" },
  { title: "Review", text: "Adds them to “Ready to apply” for you to check and send" },
];

function PipelineRunCard({ pipelineRun }: { pipelineRun: PipelineRun }) {
  const queryClient = useQueryClient();
  const cancelMutation = useMutation({
    mutationFn: () => cancelPipelineRun(pipelineRun.id),
    onSuccess: () => { toast.info("Stopping after the current step…"); queryClient.invalidateQueries({ queryKey: ["pipeline-runs"] }); },
    onError: (cancelError) => toast.error(getErrorMessage(cancelError)),
  });
  const isRunning = pipelineRun.status === "running";

  return (
    <Card className={cn(isRunning && "ring-2 ring-brand-200")}>
      <CardHeader
        title={<span className="flex items-center gap-2">Run #{pipelineRun.id} <Badge tone={RUN_STATUS_TONES[pipelineRun.status]}>{pipelineRun.status}</Badge></span>}
        description={`Started ${formatRelativeDate(pipelineRun.started_at)}`}
        actions={isRunning && (
          <Button size="sm" variant="outline" isLoading={cancelMutation.isPending} onClick={() => cancelMutation.mutate()}>
            <Square className="h-3.5 w-3.5" /> Cancel
          </Button>
        )}
      />
      <CardBody className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Jobs fetched", pipelineRun.jobs_fetched],
            ["Good matches", pipelineRun.jobs_matched],
            ["CVs tailored", pipelineRun.resumes_tailored],
            ["Cover letters", pipelineRun.cover_letters_written],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-slate-50 p-3 text-center">
              <div className="text-xl font-semibold text-slate-900">{value}</div>
              <div className="text-xs text-slate-500">{label}</div>
            </div>
          ))}
        </div>
        {pipelineRun.error_message && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{pipelineRun.error_message}</p>}
        <div className="scrollbar-thin max-h-56 overflow-y-auto rounded-xl bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-300">
          {pipelineRun.activity_log.map((logLine, lineIndex) => <div key={lineIndex}>{logLine}</div>)}
          {isRunning && <div className="animate-pulse text-brand-300">▍</div>}
        </div>
        {pipelineRun.status === "completed" && pipelineRun.resumes_tailored > 0 && (
          <Link to="/board"><Button size="sm"><CheckCircle2 className="h-4 w-4" /> Review on your board</Button></Link>
        )}
      </CardBody>
    </Card>
  );
}

export default function PipelinePage() {
  const queryClient = useQueryClient();
  const [isAddSearchOpen, setIsAddSearchOpen] = useState(false);
  const [newSearchSettings, setNewSearchSettings] = useState<FetchJobsRequest>(DEFAULT_JOB_SEARCH);
  const [selectedSearchIds, setSelectedSearchIds] = useState<number[]>([]);
  const [chosenResumeId, setChosenResumeId] = useState<number | null>(null);
  const [minimumMatchScore, setMinimumMatchScore] = useState(60);
  const [maximumResumesToTailor, setMaximumResumesToTailor] = useState(3);
  const [writeCoverLetters, setWriteCoverLetters] = useState(false);

  const { data: savedSearches = [] } = useQuery({ queryKey: ["saved-searches"], queryFn: fetchSavedSearches });
  const { data: resumes = [] } = useQuery({ queryKey: ["resumes"], queryFn: fetchResumes });
  const { data: pipelineRuns = [] } = useQuery({
    queryKey: ["pipeline-runs"],
    queryFn: fetchPipelineRuns,
    // Only poll for progress while a run the user started is in progress.
    refetchInterval: (query) => (query.state.data?.some((pipelineRun) => pipelineRun.status === "running") ? 2000 : false),
  });

  const baseResumes = resumes.filter((resume) => !resume.tailored_for_job_id);
  const selectedResumeId = chosenResumeId ?? baseResumes[0]?.id ?? null;
  const activeRun = pipelineRuns.find((pipelineRun) => pipelineRun.status === "running");

  const addSearchMutation = useMutation({
    mutationFn: () => createSavedSearch(newSearchSettings),
    onSuccess: (savedSearch) => {
      queryClient.invalidateQueries({ queryKey: ["saved-searches"] });
      setSelectedSearchIds((currentIds) => [...currentIds, savedSearch.id]);
      setNewSearchSettings(DEFAULT_JOB_SEARCH);
      setIsAddSearchOpen(false);
    },
    onError: (saveError) => toast.error(getErrorMessage(saveError)),
  });
  const deleteSearchMutation = useMutation({
    mutationFn: deleteSavedSearch,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-searches"] }),
  });
  const startMutation = useMutation({
    mutationFn: () =>
      startPipelineRun({
        saved_search_ids: selectedSearchIds,
        base_resume_id: selectedResumeId!,
        minimum_match_score: minimumMatchScore,
        maximum_resumes_to_tailor: maximumResumesToTailor,
        write_cover_letters: writeCoverLetters,
      }),
    onSuccess: () => { toast.success("Pipeline started."); queryClient.invalidateQueries({ queryKey: ["pipeline-runs"] }); },
    onError: (startError) => toast.error(getErrorMessage(startError)),
  });

  function toggleSearchSelection(savedSearchId: number) {
    setSelectedSearchIds((currentIds) =>
      currentIds.includes(savedSearchId) ? currentIds.filter((existingId) => existingId !== savedSearchId) : [...currentIds, savedSearchId],
    );
  }

  return (
    <div>
      <PageHeader title="Pipeline" description="Fetch, match and tailor in one go — then review and send the applications yourself." />

      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm text-sky-900">
        <Hand className="mt-0.5 h-4 w-4 shrink-0" />
        <span>The pipeline <strong>only runs when you press Start</strong>. Nothing is scheduled, and it never submits applications on your behalf.</span>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-4">
        {PIPELINE_STEPS.map((step, stepIndex) => (
          <div key={step.title} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">{stepIndex + 1}</div>
            <div className="mt-3 font-semibold text-slate-900">{step.title}</div>
            <div className="mt-0.5 text-sm text-slate-500">{step.text}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="1. Saved searches"
              icon={<Search className="h-4 w-4" />}
              description="Tick the searches to run."
              actions={<Button size="sm" variant="secondary" onClick={() => setIsAddSearchOpen(true)}><Plus className="h-4 w-4" /> Add search</Button>}
            />
            <CardBody className="space-y-2">
              {savedSearches.length === 0 && <p className="text-sm text-slate-500">Add a search such as “Data Analyst in Sydney”.</p>}
              {savedSearches.map((savedSearch) => (
                <div key={savedSearch.id} className={cn("flex items-center gap-3 rounded-xl border p-3", selectedSearchIds.includes(savedSearch.id) ? "border-brand-300 bg-brand-50/50" : "border-slate-200")}>
                  <input type="checkbox" checked={selectedSearchIds.includes(savedSearch.id)} onChange={() => toggleSearchSelection(savedSearch.id)} className="h-4 w-4 accent-brand-600" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-900">{savedSearch.search_term}</div>
                    <div className="truncate text-xs text-slate-500">
                      {savedSearch.location || savedSearch.country} · {savedSearch.sites.map((siteName) => JOB_SITE_LABELS[siteName]).join(", ")} · {savedSearch.results_wanted} results
                    </div>
                  </div>
                  <button onClick={() => deleteSearchMutation.mutate(savedSearch.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete search">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="2. Options" icon={<Workflow className="h-4 w-4" />} />
            <CardBody className="space-y-4">
              <Field label="Base CV to tailor from">
                <SelectInput value={selectedResumeId ?? ""} onChange={(changeEvent) => setChosenResumeId(Number(changeEvent.target.value))}>
                  {baseResumes.length === 0 && <option value="">Upload a CV first</option>}
                  {baseResumes.map((resume) => <option key={resume.id} value={resume.id}>{resume.title}</option>)}
                </SelectInput>
              </Field>
              <Field label={`Minimum match score: ${minimumMatchScore}%`}>
                <input type="range" min={0} max={100} step={5} value={minimumMatchScore} onChange={(changeEvent) => setMinimumMatchScore(Number(changeEvent.target.value))} className="w-full accent-brand-600" />
              </Field>
              <Field label="Maximum CVs to tailor" hint="Each tailored CV uses one AI request (and Claude plan usage if you use your subscription).">
                <SelectInput value={maximumResumesToTailor} onChange={(changeEvent) => setMaximumResumesToTailor(Number(changeEvent.target.value))}>
                  {[0, 1, 2, 3, 5, 10].map((countOption) => <option key={countOption} value={countOption}>{countOption === 0 ? "None (just fetch and match)" : countOption}</option>)}
                </SelectInput>
              </Field>
              <Checkbox label="Also write a cover letter for each" checked={writeCoverLetters} onChange={setWriteCoverLetters} />
              <Button
                size="lg"
                className="w-full"
                isLoading={startMutation.isPending}
                disabled={Boolean(activeRun) || selectedSearchIds.length === 0 || selectedResumeId === null}
                onClick={() => startMutation.mutate()}
              >
                {!startMutation.isPending && <Play className="h-4 w-4" />} {activeRun ? "A run is in progress" : "Start pipeline"}
              </Button>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">Recent runs</h2>
          {pipelineRuns.length === 0 ? (
            <EmptyState icon={<Workflow className="h-6 w-6" />} title="No runs yet" description="Choose your searches and options, then press Start." />
          ) : (
            pipelineRuns.map((pipelineRun) => <PipelineRunCard key={pipelineRun.id} pipelineRun={pipelineRun} />)
          )}
        </div>
      </div>

      <Dialog
        isOpen={isAddSearchOpen}
        onClose={() => setIsAddSearchOpen(false)}
        size="lg"
        title="Add a saved search"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsAddSearchOpen(false)}>Cancel</Button>
            <Button isLoading={addSearchMutation.isPending} disabled={newSearchSettings.search_term.trim().length < 2 || newSearchSettings.sites.length === 0} onClick={() => addSearchMutation.mutate()}>
              Save search
            </Button>
          </>
        }
      >
        <JobSearchForm searchSettings={newSearchSettings} onChange={setNewSearchSettings} />
      </Dialog>
    </div>
  );
}
