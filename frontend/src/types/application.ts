// Mirrors backend/app/schemas/application.py and cover_letter.py

export type ApplicationStatus = "saved" | "tailoring" | "ready_to_apply" | "applied" | "interview" | "offer" | "rejected";

export const APPLICATION_STATUS_ORDER: ApplicationStatus[] = [
  "saved",
  "tailoring",
  "ready_to_apply",
  "applied",
  "interview",
  "offer",
  "rejected",
];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: "Saved",
  tailoring: "Tailoring",
  ready_to_apply: "Ready to apply",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

export interface ApplicationCard {
  id: number;
  status: ApplicationStatus;
  job_id: number;
  job_title: string;
  company: string;
  location: string;
  job_url: string | null;
  apply_url: string | null;
  resume_id: number | null;
  cover_letter_id: number | null;
  notes: string;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StatusChange {
  from_status: string | null;
  to_status: string;
  changed_at: string;
}

export interface ApplicationDetail extends ApplicationCard {
  status_history: StatusChange[];
}

export interface CoverLetter {
  id: number;
  job_id: number;
  job_title: string;
  company: string;
  resume_id: number | null;
  body: string;
  created_at: string;
  updated_at: string;
}
