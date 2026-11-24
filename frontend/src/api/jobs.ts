import type {
  FetchJobsRequest,
  FetchJobsResult,
  ImportJobRequest,
  JobDetail,
  JobMatch,
  JobSiteName,
  JobSummary,
  SavedJobSearch,
} from "@/types/job";
import type { TailorResumeResult } from "@/types/resume";

import { sendJsonRequest } from "./client";

export interface JobListFilters {
  search?: string;
  source?: string;
  remoteOnly?: boolean;
}

export function fetchJobs(jobFilters: JobListFilters = {}) {
  const queryParameters = new URLSearchParams();
  if (jobFilters.search) queryParameters.set("search", jobFilters.search);
  if (jobFilters.source) queryParameters.set("source", jobFilters.source);
  if (jobFilters.remoteOnly) queryParameters.set("remote_only", "true");
  return sendJsonRequest<JobSummary[]>(`/jobs?${queryParameters.toString()}`);
}

export const fetchJob = (jobId: number) => sendJsonRequest<JobDetail>(`/jobs/${jobId}`);

export const fetchJobsFromJobSites = (searchSettings: FetchJobsRequest) =>
  sendJsonRequest<FetchJobsResult>("/jobs/fetch", { method: "POST", jsonBody: searchSettings });

export const importJob = (importDetails: ImportJobRequest) =>
  sendJsonRequest<JobDetail>("/jobs/import", { method: "POST", jsonBody: importDetails });

export const deleteJob = (jobId: number) => sendJsonRequest<void>(`/jobs/${jobId}`, { method: "DELETE" });

export const loadJobDescription = (jobId: number) =>
  sendJsonRequest<JobDetail>(`/jobs/${jobId}/load-description`, { method: "POST" });

export const updateJobDescription = (jobId: number, description: string) =>
  sendJsonRequest<JobDetail>(`/jobs/${jobId}/description`, { method: "PUT", jsonBody: { description } });

export const analyzeJob =(jobId: number) => sendJsonRequest<JobDetail>(`/jobs/${jobId}/analyze`, { method: "POST" });

export const tailorResumeForJob = (jobId: number, resumeId: number) =>
  sendJsonRequest<TailorResumeResult>(`/jobs/${jobId}/tailor`, { method: "POST", jsonBody: { resume_id: resumeId } });

export const fetchJobMatches = (resumeId: number) => sendJsonRequest<JobMatch[]>(`/jobs/matches?resume_id=${resumeId}`);

export const findJobsForResume = (searchSettings: {
  resume_id: number;
  location: string;
  country: string;
  sites: JobSiteName[];
  results_wanted: number;
}) => sendJsonRequest<FetchJobsResult>("/jobs/find-for-resume", { method: "POST", jsonBody: searchSettings });

export const fetchSavedSearches = () => sendJsonRequest<SavedJobSearch[]>("/jobs/saved-searches");

export const createSavedSearch = (searchSettings: FetchJobsRequest) =>
  sendJsonRequest<SavedJobSearch>("/jobs/saved-searches", { method: "POST", jsonBody: searchSettings });

export const deleteSavedSearch = (savedSearchId: number) =>
  sendJsonRequest<void>(`/jobs/saved-searches/${savedSearchId}`, { method: "DELETE" });
