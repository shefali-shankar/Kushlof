import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/classNames";

export function Card({ className, ...otherProperties }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-2xl border border-slate-200/80 bg-white shadow-[var(--shadow-card)]", className)}
      {...otherProperties}
    />
  );
}

interface CardHeaderProperties {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function CardHeader({ title, description, icon, actions, className }: CardHeaderProperties) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && <div className="mt-0.5 rounded-lg bg-brand-50 p-2 text-brand-600">{icon}</div>}
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, ...otherProperties }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4", className)} {...otherProperties} />;
}
