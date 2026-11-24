import type {
  ATSScoreReport,
  ResumeContent,
  ResumeDetail,
  ResumeSectionName,
  ResumeSuggestion,
  ResumeSummary,
  ResumeTemplateName,
  RewriteSectionResult,
} from "@/types/resume";

import { downloadFile, sendJsonRequest, uploadFile } from "./client";

export const fetchResumes = () => sendJsonRequest<ResumeSummary[]>("/resumes");

export const fetchResume = (resumeId: number) => sendJsonRequest<ResumeDetail>(`/resumes/${resumeId}`);

export const uploadResume = (resumeFile: File) => uploadFile<ResumeDetail>("/resumes/upload", resumeFile);

export const createBlankResume = (title: string) =>
  sendJsonRequest<ResumeDetail>("/resumes", { method: "POST", jsonBody: { title } });

export const updateResume = (
  resumeId: number,
  changes: { title?: string; content?: ResumeContent; template_name?: ResumeTemplateName },
) => sendJsonRequest<ResumeDetail>(`/resumes/${resumeId}`, { method: "PATCH", jsonBody: changes });

export const deleteResume = (resumeId: number) => sendJsonRequest<void>(`/resumes/${resumeId}`, { method: "DELETE" });

export const duplicateResume = (resumeId: number) =>
  sendJsonRequest<ResumeDetail>(`/resumes/${resumeId}/duplicate`, { method: "POST" });

export const renderResumePreview = (content: ResumeContent, templateName: ResumeTemplateName) =>
  sendJsonRequest<{ html: string }>("/resumes/preview", {
    method: "POST",
    jsonBody: { content, template_name: templateName },
  });

export const fetchAtsScore = (resumeId: number, jobId?: number | null) =>
  sendJsonRequest<ATSScoreReport>(`/resumes/${resumeId}/ats-score${jobId ? `?job_id=${jobId}` : ""}`);

export const requestAiReview = (resumeId: number, jobId?: number | null) =>
  sendJsonRequest<ResumeSuggestion[]>(`/resumes/${resumeId}/ai-review`, {
    method: "POST",
    jsonBody: { job_id: jobId ?? null },
  });

export const requestSectionRewrite = (
  resumeId: number,
  section: ResumeSectionName,
  instruction: string,
  jobId?: number | null,
) =>
  sendJsonRequest<RewriteSectionResult>(`/resumes/${resumeId}/rewrite-section`, {
    method: "POST",
    jsonBody: { section, instruction, job_id: jobId ?? null },
  });

export const downloadResume = (resumeId: number, fileFormat: "pdf" | "docx") =>
  downloadFile(`/resumes/${resumeId}/export?format=${fileFormat}`, `CV.${fileFormat}`);
