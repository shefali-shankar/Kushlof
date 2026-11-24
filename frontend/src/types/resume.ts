// Mirrors backend/app/schemas/resume_content.py and resume.py

export interface ResumeBasics {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  linkedin: string;
}

export interface WorkExperience {
  company: string;
  position: string;
  location: string;
  start_date: string;
  end_date: string;
  highlights: string[];
}

export interface Education {
  institution: string;
  degree: string;
  field_of_study: string;
  start_date: string;
  end_date: string;
  grade: string;
}

export interface SkillGroup {
  name: string;
  keywords: string[];
}

export interface Project {
  name: string;
  description: string;
  url: string;
  highlights: string[];
}

export interface Certification {
  name: string;
  issuer: string;
  date: string;
}

export interface ResumeContent {
  basics: ResumeBasics;
  summary: string;
  work: WorkExperience[];
  education: Education[];
  skills: SkillGroup[];
  projects: Project[];
  certifications: Certification[];
}

export type ResumeSectionName = "summary" | "work" | "education" | "skills" | "projects" | "certifications";
export type ResumeTemplateName = "classic" | "modern";

export interface ResumeSummary {
  id: number;
  title: string;
  template_name: ResumeTemplateName;
  tailored_for_job_id: number | null;
  tailored_for_job_title: string | null;
  candidate_name: string;
  created_at: string;
  updated_at: string;
}

export interface ResumeDetail extends ResumeSummary {
  content: ResumeContent;
  based_on_resume_id: number | null;
  tailoring_notes: string[];
  original_filename: string | null;
}

export interface ATSCheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

export type SuggestionSection = ResumeSectionName | "basics" | "general";

export interface ResumeSuggestion {
  section: SuggestionSection;
  message: string;
  severity: "high" | "medium" | "low";
  source: "rules" | "ai";
}

export interface ATSScoreReport {
  total_score: number;
  keyword_score: number | null;
  formatting_score: number;
  content_score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  checks: ATSCheckResult[];
  suggestions: ResumeSuggestion[];
}

export interface RewriteSectionResult {
  section: ResumeSectionName;
  original_value: unknown;
  proposed_value: unknown;
}

export interface TailorResumeResult {
  tailored_resume_id: number;
  score_before: ATSScoreReport;
  score_after: ATSScoreReport;
  change_notes: string[];
}

export function createEmptyResumeContent(): ResumeContent {
  return {
    basics: { name: "", headline: "", email: "", phone: "", location: "", website: "", linkedin: "" },
    summary: "",
    work: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
  };
}
