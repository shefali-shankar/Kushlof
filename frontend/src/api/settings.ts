import type {
  AIProvider,
  AITaskAssignment,
  ConnectionTestResult,
  DashboardSummary,
  PipelineRun,
  StartPipelineRequest,
} from "@/types/settings";

import { sendJsonRequest } from "./client";

// AI providers and models
export const fetchAiProviders = () => sendJsonRequest<AIProvider[]>("/ai-settings/providers");

export const updateAiProvider = (providerName: string, changes: { api_key?: string; base_url?: string }) =>
  sendJsonRequest<AIProvider>(`/ai-settings/providers/${providerName}`, { method: "PUT", jsonBody: changes });

export const fetchAiTaskAssignments = () => sendJsonRequest<AITaskAssignment[]>("/ai-settings/tasks");

export const updateAiTaskAssignment = (taskName: string, providerName: string, modelName: string) =>
  sendJsonRequest<AITaskAssignment>(`/ai-settings/tasks/${taskName}`, {
    method: "PUT",
    jsonBody: { provider_name: providerName, model_name: modelName },
  });

export const testAiConnection = (providerName: string, modelName: string) =>
  sendJsonRequest<ConnectionTestResult>("/ai-settings/test-connection", {
    method: "POST",
    jsonBody: { provider_name: providerName, model_name: modelName },
  });

// Pipeline (only runs when started from the Pipeline page)
export const startPipelineRun = (pipelineOptions: StartPipelineRequest) =>
  sendJsonRequest<PipelineRun>("/pipeline/runs", { method: "POST", jsonBody: pipelineOptions });

export const fetchPipelineRuns = () => sendJsonRequest<PipelineRun[]>("/pipeline/runs");

export const fetchPipelineRun = (runId: number) => sendJsonRequest<PipelineRun>(`/pipeline/runs/${runId}`);

export const cancelPipelineRun = (runId: number) =>
  sendJsonRequest<PipelineRun>(`/pipeline/runs/${runId}/cancel`, { method: "POST" });

// Dashboard
export const fetchDashboardSummary = () => sendJsonRequest<DashboardSummary>("/dashboard/summary");
