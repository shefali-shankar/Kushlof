import { FileUp } from "lucide-react";
import { type DragEvent, useRef, useState } from "react";

import { cn } from "@/lib/classNames";

const ACCEPTED_FILE_TYPES = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

interface ResumeUploadDropzoneProperties {
  onFileSelected: (selectedFile: File) => void;
  isUploading: boolean;
}

// A drag-and-drop area (or click to browse) for uploading a PDF or Word CV.
export function ResumeUploadDropzone({ onFileSelected, isUploading }: ResumeUploadDropzoneProperties) {
  const fileInputReference = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  function handleDrop(dropEvent: DragEvent<HTMLDivElement>) {
    dropEvent.preventDefault();
    setIsDraggingOver(false);
    const droppedFile = dropEvent.dataTransfer.files[0];
    if (droppedFile) onFileSelected(droppedFile);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !isUploading && fileInputReference.current?.click()}
      onKeyDown={(keyEvent) => keyEvent.key === "Enter" && fileInputReference.current?.click()}
      onDragOver={(dragEvent) => {
        dragEvent.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={handleDrop}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition",
        isDraggingOver ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-white hover:border-brand-400 hover:bg-brand-50/40",
        isUploading && "pointer-events-none opacity-70",
      )}
    >
      <div className="mb-3 rounded-2xl bg-brand-50 p-3 text-brand-600">
        <FileUp className="h-6 w-6" />
      </div>
      <p className="font-semibold text-slate-900">{isUploading ? "Reading your CV…" : "Drop your CV here, or click to browse"}</p>
      <p className="mt-1 text-sm text-slate-500">
        {isUploading ? "The AI is splitting it into sections. This can take a minute or two." : "PDF or Word (.docx), up to 10 MB"}
      </p>
      <input
        ref={fileInputReference}
        type="file"
        accept={ACCEPTED_FILE_TYPES}
        className="hidden"
        onChange={(changeEvent) => {
          const selectedFile = changeEvent.target.files?.[0];
          if (selectedFile) onFileSelected(selectedFile);
          changeEvent.target.value = "";
        }}
      />
    </div>
  );
}
