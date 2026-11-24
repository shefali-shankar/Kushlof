import { cn } from "@/lib/classNames";

export function BrandLogo({ className, showName = true, nameClassName }: { className?: string; showName?: boolean; nameClassName?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 shadow-lg shadow-brand-500/30">
        <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden="true">
          <path d="M10 7v18M10 16l9-9M13.5 12.5l6.5 12.5" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </div>
      {showName && <span className={cn("text-lg font-semibold tracking-tight", nameClassName)}>Kushlof</span>}
    </div>
  );
}
