import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Link2, Search, Sparkles, Target } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

import { fetchJobMatches, fetchJobs, findJobsForResume } from "@/api/jobs";
import { fetchResumes } from "@/api/resumes";
import { FetchJobsDialog } from "@/components/jobs/FetchJobsDialog";
import { ImportJobDialog } from "@/components/jobs/ImportJobDialog";
import { JobListingCard } from "@/components/jobs/JobListingCard";
import { Button } from "@/components/ui/Button";
import { Checkbox, SelectInput, TextInput } from "@/components/ui/FormFields";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingState, WorkingBanner } from "@/components/ui/StatusDisplays";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cn } from "@/lib/classNames";
import { getErrorMessage } from "@/lib/formatters";

type JobsView = "all" | "matches";

function AllJobsList({ onFindJobs }: { onFindJobs: () => void }) {
  const [searchText, setSearchText] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const debouncedSearchText = useDebouncedValue(searchText, 300);
  const { data: jobs, isLoading, error } = useQuery({
    queryKey: ["jobs", debouncedSearchText, sourceFilter, remoteOnly],
    queryFn: () => fetchJobs({ search: debouncedSearchText, source: sourceFilter, remoteOnly }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[var(--shadow-card)]">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <TextInput value={searchText} onChange={(changeEvent) => setSearchText(changeEvent.target.value)} placeholder="Search title, company or location" className="pl-9" />
        </div>
        <SelectInput value={sourceFilter} onChange={(changeEvent) => setSourceFilter(changeEvent.target.value)} className="w-44">
          <option value="">All sources</option>
          <option value="linkedin">LinkedIn</option>
          <option value="indeed">Indeed</option>
          <option value="glassdoor">Glassdoor</option>
          <option value="google">Google Jobs</option>
          <option value="imported">Imported links</option>
          <option value="pasted">Pasted</option>
        </SelectInput>
        <Checkbox label="Remote only" checked={remoteOnly} onChange={setRemoteOnly} />
      </div>

      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} />}
      {jobs && jobs.length === 0 && (
        <EmptyState
          icon={<Briefcase className="h-6 w-6" />}
          title="No jobs yet"
          description="Search job sites or paste a job link to get started."
          action={<Button onClick={onFindJobs}><Search className="h-4 w-4" /> Find jobs</Button>}
        />
      )}
      <div className="space-y-3">
        {jobs?.map((job) => <JobListingCard key={job.id} job={job} />)}
      </div>
    </div>
  );
}

function MatchedJobsList({ initialResumeId }: { initialResumeId: number | null }) {
  const queryClient = useQueryClient();
  const { data: resumes = [] } = useQuery({ queryKey: ["resumes"], queryFn: fetchResumes });
  const [chosenResumeId, setChosenResumeId] = useState<number | null>(initialResumeId);
  const [searchLocation, setSearchLocation] = useState("");
  const selectedResumeId = chosenResumeId ?? resumes.find((resume) => !resume.tailored_for_job_id)?.id ?? null;

  const { data: jobMatches, isLoading, error } = useQuery({
    queryKey: ["job-matches", selectedResumeId],
    queryFn: () => fetchJobMatches(selectedResumeId!),
    enabled: selectedResumeId !== null,
  });
  const findJobsMutation = useMutation({
    mutationFn: () =>
      findJobsForResume({ resume_id: selectedResumeId!, location: searchLocation, country: "Australia", sites: ["linkedin", "indeed"], results_wanted: 20 }),
    onSuccess: (fetchResult) => {
      toast.success(`Found ${fetchResult.jobs_found} jobs (${fetchResult.new_jobs} new).`);
      queryClient.invalidateQueries({ queryKey: ["job-matches"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (findError) => toast.error(getErrorMessage(findError)),
  });

  if (resumes.length === 0) {
    return <EmptyState icon={<Target className="h-6 w-6" />} title="Upload a CV first" description="Kushlof ranks jobs by how well they match your CV." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-card)]">
        <label className="min-w-56 flex-1 space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Match jobs to this CV</span>
          <SelectInput value={selectedResumeId ?? ""} onChange={(changeEvent) => setChosenResumeId(Number(changeEvent.target.value))}>
            {resumes.map((resume) => <option key={resume.id} value={resume.id}>{resume.title}</option>)}
          </SelectInput>
        </label>
        <label className="w-48 space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Location</span>
          <TextInput value={searchLocation} onChange={(changeEvent) => setSearchLocation(changeEvent.target.value)} placeholder="e.g. Melbourne" />
        </label>
        <Button variant="secondary" isLoading={findJobsMutation.isPending} onClick={() => findJobsMutation.mutate()}>
          {!findJobsMutation.isPending && <Sparkles className="h-4 w-4" />} Search new jobs for this CV
        </Button>
      </div>
      {findJobsMutation.isPending && <WorkingBanner message="Searching LinkedIn and Indeed using your CV's job title…" />}
      {isLoading && <LoadingState message="Ranking jobs…" />}
      {error && <ErrorState error={error} />}
      {jobMatches && jobMatches.length === 0 && (
        <EmptyState icon={<Target className="h-6 w-6" />} title="No saved jobs to rank" description="Search for new jobs using the button above." />
      )}
      <div className="space-y-3">
        {jobMatches?.map((jobMatch) => (
          <JobListingCard key={jobMatch.job.id} job={jobMatch.job} matchScore={jobMatch.match_score} matchedKeywords={jobMatch.matched_keywords} />
        ))}
      </div>
    </div>
  );
}

export default function JobsPage() {
  const queryClient = useQueryClient();
  const [searchParameters, setSearchParameters] = useSearchParams();
  const resumeIdFromLink = searchParameters.get("matchResume");
  const [activeView, setActiveView] = useState<JobsView>(resumeIdFromLink ? "matches" : "all");
  const isFetchDialogOpen = searchParameters.get("fetch") === "1";
  const isImportDialogOpen = searchParameters.get("import") === "1";

  function setDialogOpen(dialogName: "fetch" | "import", isOpen: boolean) {
    const updatedParameters = new URLSearchParams(searchParameters);
    if (isOpen) updatedParameters.set(dialogName, "1");
    else updatedParameters.delete(dialogName);
    setSearchParameters(updatedParameters, { replace: true });
  }

  return (
    <div>
      <PageHeader
        title="Jobs"
        description="Search job sites, import a job from any link, or see which saved jobs best match your CV."
        actions={
          <>
            <Button variant="outline" onClick={() => setDialogOpen("import", true)}><Link2 className="h-4 w-4" /> Import a job</Button>
            <Button onClick={() => setDialogOpen("fetch", true)}><Search className="h-4 w-4" /> Find jobs</Button>
          </>
        }
      />

      <div className="mb-5 inline-flex rounded-xl bg-slate-200/60 p-1">
        {([["all", "All saved jobs"], ["matches", "Best matches for my CV"]] as const).map(([view, label]) => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className={cn("rounded-lg px-4 py-2 text-sm font-medium", activeView === view ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}
          >
            {label}
          </button>
        ))}
      </div>

      {activeView === "all" ? (
        <AllJobsList onFindJobs={() => setDialogOpen("fetch", true)} />
      ) : (
        <MatchedJobsList initialResumeId={resumeIdFromLink ? Number(resumeIdFromLink) : null} />
      )}

      <FetchJobsDialog
        isOpen={isFetchDialogOpen}
        onClose={() => setDialogOpen("fetch", false)}
        onJobsFetched={() => queryClient.invalidateQueries({ queryKey: ["jobs"] })}
      />
      <ImportJobDialog isOpen={isImportDialogOpen} onClose={() => setDialogOpen("import", false)} />
    </div>
  );
}
