import { AlertTriangle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/classNames";
import { getErrorMessage } from "@/lib/formatters";

export function LoadingState({ message = "Loading…", className }: { message?: string; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-2 py-16 text-sm text-slate-500", className)}>
      <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
      {message}
    </div>
  );
}

export function ErrorState({ error, className }: { error: unknown; className?: string }) {
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800", className)}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{getErrorMessage(error)}</span>
    </div>
  );
}

interface EmptyStateProperties {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProperties) {
  return (
    <div className={cn("flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center", className)}>
      <div className="mb-4 rounded-2xl bg-brand-50 p-3 text-brand-600">{icon}</div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// A friendly message shown while a slow AI task runs.
export function WorkingBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{message}</span>
    </div>
  );
}
