import type { ApplicationCard, ApplicationDetail, ApplicationStatus, CoverLetter } from "@/types/application";

import { downloadFile, sendJsonRequest } from "./client";

export const fetchApplications = () => sendJsonRequest<ApplicationCard[]>("/applications");

export const fetchApplication = (applicationId: number) =>
  sendJsonRequest<ApplicationDetail>(`/applications/${applicationId}`);

export const addJobToBoard = (jobId: number) =>
  sendJsonRequest<ApplicationDetail>("/applications", { method: "POST", jsonBody: { job_id: jobId } });

export const updateApplication = (
  applicationId: number,
  changes: { status?: ApplicationStatus; notes?: string; resume_id?: number | null; cover_letter_id?: number | null },
) => sendJsonRequest<ApplicationDetail>(`/applications/${applicationId}`, { method: "PATCH", jsonBody: changes });

export const markApplicationAsApplied = (applicationId: number) =>
  sendJsonRequest<ApplicationDetail>(`/applications/${applicationId}/mark-applied`, { method: "POST" });

export const removeApplication = (applicationId: number) =>
  sendJsonRequest<void>(`/applications/${applicationId}`, { method: "DELETE" });

export const fetchCoverLetters = (jobId?: number) =>
  sendJsonRequest<CoverLetter[]>(`/cover-letters${jobId ? `?job_id=${jobId}` : ""}`);

export const fetchCoverLetter = (coverLetterId: number) => sendJsonRequest<CoverLetter>(`/cover-letters/${coverLetterId}`);

export const generateCoverLetter = (jobId: number, resumeId: number, extraInstructions: string) =>
  sendJsonRequest<CoverLetter>("/cover-letters", {
    method: "POST",
    jsonBody: { job_id: jobId, resume_id: resumeId, extra_instructions: extraInstructions },
  });

export const updateCoverLetter = (coverLetterId: number, body: string) =>
  sendJsonRequest<CoverLetter>(`/cover-letters/${coverLetterId}`, { method: "PATCH", jsonBody: { body } });

export const deleteCoverLetter = (coverLetterId: number) =>
  sendJsonRequest<void>(`/cover-letters/${coverLetterId}`, { method: "DELETE" });

export const downloadCoverLetter = (coverLetterId: number, fileFormat: "pdf" | "docx") =>
  downloadFile(`/cover-letters/${coverLetterId}/export?format=${fileFormat}`, `Cover_Letter.${fileFormat}`);
