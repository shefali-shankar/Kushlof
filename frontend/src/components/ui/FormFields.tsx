import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/classNames";

const INPUT_CLASSES =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 " +
  "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500";

interface FieldProperties {
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}

// A labelled form control with an optional hint underneath.
export function Field({ label, hint, className, children }: FieldProperties) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function TextInput({ className, ...otherProperties }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(INPUT_CLASSES, "h-10", className)} {...otherProperties} />;
}

export function TextArea({ className, ...otherProperties }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(INPUT_CLASSES, "min-h-24 leading-relaxed", className)} {...otherProperties} />;
}

export function SelectInput({ className, children, ...otherProperties }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(INPUT_CLASSES, "h-10 pr-8", className)} {...otherProperties}>
      {children}
    </select>
  );
}

interface CheckboxProperties {
  label: ReactNode;
  checked: boolean;
  onChange: (isChecked: boolean) => void;
}

export function Checkbox({ label, checked, onChange }: CheckboxProperties) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700 select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(changeEvent) => onChange(changeEvent.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-brand-600 accent-brand-600"
      />
      {label}
    </label>
  );
}
