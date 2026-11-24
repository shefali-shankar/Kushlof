import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { renderResumePreview } from "@/api/resumes";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { ResumeContent, ResumeTemplateName } from "@/types/resume";

interface ResumePreviewProperties {
  content: ResumeContent;
  templateName: ResumeTemplateName;
  className?: string;
}

// Live preview of the CV exactly as it will be exported. Updates shortly after you stop typing.
// The preview runs in a sandboxed frame with scripts disabled, so CV text can never run code.
export function ResumePreview({ content, templateName, className }: ResumePreviewProperties) {
  const debouncedContent = useDebouncedValue(content, 450);
  const { data: renderedPreview, isFetching } = useQuery({
    queryKey: ["resume-preview", templateName, debouncedContent],
    queryFn: () => renderResumePreview(debouncedContent, templateName),
    placeholderData: (previousPreview) => previousPreview,
  });

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-200/60 p-3 shadow-inner">
        {isFetching && (
          <div className="absolute top-5 right-5 z-10 flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-slate-500 shadow">
            <Loader2 className="h-3 w-3 animate-spin" /> Updating
          </div>
        )}
        <iframe
          title="CV preview"
          sandbox=""
          srcDoc={renderedPreview?.html ?? ""}
          className="h-[min(80dvh,1100px)] w-full rounded-lg bg-white shadow-md"
        />
      </div>
    </div>
  );
}
