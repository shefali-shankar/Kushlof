import { useMutation } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { fetchJobsFromJobSites } from "@/api/jobs";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorState, WorkingBanner } from "@/components/ui/StatusDisplays";
import type { FetchJobsRequest } from "@/types/job";

import { DEFAULT_JOB_SEARCH, JobSearchForm } from "./JobSearchForm";

// Search LinkedIn, Indeed and other sites now. Runs only when the user clicks "Search".
export function FetchJobsDialog({ isOpen, onClose, onJobsFetched }: { isOpen: boolean; onClose: () => void; onJobsFetched: () => void }) {
  const [searchSettings, setSearchSettings] = useState<FetchJobsRequest>(DEFAULT_JOB_SEARCH);
  const fetchMutation = useMutation({
    mutationFn: () => fetchJobsFromJobSites(searchSettings),
    onSuccess: (fetchResult) => {
      toast.success(`Found ${fetchResult.jobs_found} jobs (${fetchResult.new_jobs} new).`);
      onJobsFetched();
      onClose();
    },
  });

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title="Find jobs"
      description="Searches the selected job sites and saves the results. Keep searches small — job sites limit heavy use."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            isLoading={fetchMutation.isPending}
            disabled={searchSettings.search_term.trim().length < 2 || searchSettings.sites.length === 0}
            onClick={() => fetchMutation.mutate()}
          >
            {!fetchMutation.isPending && <Search className="h-4 w-4" />} Search
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <JobSearchForm searchSettings={searchSettings} onChange={setSearchSettings} />
        {fetchMutation.isPending && <WorkingBanner message="Searching job sites… this usually takes 20–60 seconds." />}
        {fetchMutation.error && <ErrorState error={fetchMutation.error} />}
      </div>
    </Dialog>
  );
}
