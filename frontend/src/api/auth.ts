import type { SessionStatus } from "@/types/settings";

import { sendJsonRequest } from "./client";

export const fetchSessionStatus = () => sendJsonRequest<SessionStatus>("/auth/session");

export const signIn = (username: string) =>
  sendJsonRequest<SessionStatus>("/auth/sign-in", { method: "POST", jsonBody: { username } });

export const signOut = () => sendJsonRequest<{ message: string }>("/auth/sign-out", { method: "POST" });
