// Mirrors backend/app/schemas/ai_settings.py, pipeline.py and dashboard.py

import type { ApplicationCard } from "./application";

export interface AIProvider {
  name: string;
  display_name: string;
  description: string;
  needs_api_key: boolean;
  needs_base_url: boolean;
  has_api_key: boolean;
  masked_api_key: string | null;
  base_url: string | null;
  suggested_models: string[];
}

export interface AITaskAssignment {
  task_name: string;
  display_name: string;
  description: string;
  provider_name: string;
  model_name: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
}

export interface PipelineRun {
  id: number;
  status: "running" | "completed" | "failed" | "cancelled";
  current_step: string;
  jobs_fetched: number;
  jobs_matched: number;
  resumes_tailored: number;
  cover_letters_written: number;
  error_message: string | null;
  activity_log: string[];
  started_at: string;
  finished_at: string | null;
}

export interface StartPipelineRequest {
  saved_search_ids: number[];
  base_resume_id: number;
  minimum_match_score: number;
  maximum_resumes_to_tailor: number;
  write_cover_letters: boolean;
}

export interface DashboardSummary {
  resume_count: number;
  job_count: number;
  application_counts_by_status: Record<string, number>;
  recent_applications: ApplicationCard[];
  latest_pipeline_run: PipelineRun | null;
}

export interface SessionStatus {
  is_signed_in: boolean;
  profile_exists: boolean;
  username: string | null;
}
