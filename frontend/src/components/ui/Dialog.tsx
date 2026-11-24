import { X } from "lucide-react";
import { type ReactNode, useEffect } from "react";

import { cn } from "@/lib/classNames";

interface DialogProperties {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg" | "xl";
  placement?: "center" | "side";
  children: ReactNode;
}

const SIZE_CLASSES = { md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

// A modal window (centred) or slide-over panel (side). Closes on Escape or clicking the backdrop.
export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  footer,
  size = "md",
  placement = "center",
  children,
}: DialogProperties) {
  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (keyEvent: KeyboardEvent) => keyEvent.key === "Escape" && onClose();
    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const isSidePanel = placement === "side";

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative flex max-h-full w-full flex-col bg-white shadow-[var(--shadow-raised)]",
          isSidePanel
            ? "ml-auto h-full max-w-xl"
            : cn("m-auto max-h-[calc(100dvh-2rem)] rounded-2xl sm:mx-auto", SIZE_CLASSES[size], "mx-4"),
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
