// Mirrors backend/app/schemas/job.py

export type JobSiteName = "linkedin" | "indeed" | "glassdoor" | "google" | "zip_recruiter";

export interface JobSummary {
  id: number;
  title: string;
  company: string;
  location: string;
  source: string;
  is_remote: boolean;
  salary: string | null;
  job_type: string | null;
  date_posted: string | null;
  job_url: string | null;
  created_at: string;
  application_status: string | null;
}

export interface JobRequirements {
  job_title: string;
  company: string;
  seniority: string;
  required_skills: string[];
  preferred_skills: string[];
  ats_keywords: string[];
  responsibilities: string[];
}

export interface JobDetail extends JobSummary {
  description: string;
  apply_url: string | null;
  requirements: JobRequirements | null;
  application_id: number | null;
}

export interface FetchJobsRequest {
  search_term: string;
  location: string;
  country: string;
  sites: JobSiteName[];
  results_wanted: number;
  hours_old: number;
  is_remote: boolean;
}

export interface FetchJobsResult {
  jobs_found: number;
  new_jobs: number;
}

export interface ImportJobRequest {
  url?: string;
  pasted_description?: string;
  title?: string;
  company?: string;
}

export interface JobMatch {
  job: JobSummary;
  match_score: number;
  matched_keywords: string[];
}

export interface SavedJobSearch extends FetchJobsRequest {
  id: number;
  created_at: string;
}

export const JOB_SITE_LABELS: Record<JobSiteName, string> = {
  linkedin: "LinkedIn",
  indeed: "Indeed",
  glassdoor: "Glassdoor",
  google: "Google Jobs",
  zip_recruiter: "ZipRecruiter",
};
