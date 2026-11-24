import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { FileText, Mail, MapPin } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/classNames";
import { formatRelativeDate } from "@/lib/formatters";
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_ORDER, type ApplicationCard, type ApplicationStatus } from "@/types/application";

import { STATUS_ACCENT_CLASSES } from "./applicationStatusStyles";

function ApplicationCardContent({ application, isDragging = false }: { application: ApplicationCard; isDragging?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm", isDragging && "rotate-2 shadow-xl ring-2 ring-brand-300")}>
      <div className="font-medium leading-snug text-slate-900">{application.job_title}</div>
      <div className="mt-0.5 text-sm text-slate-500">{application.company || "Unknown company"}</div>
      {application.location && (
        <div className="mt-1.5 flex items-center gap-1 text-xs text-slate-400"><MapPin className="h-3 w-3" />{application.location}</div>
      )}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-1.5">
          {application.resume_id && <span className="rounded-md bg-brand-50 p-1 text-brand-600" title="Tailored CV attached"><FileText className="h-3.5 w-3.5" /></span>}
          {application.cover_letter_id && <span className="rounded-md bg-violet-50 p-1 text-violet-600" title="Cover letter attached"><Mail className="h-3.5 w-3.5" /></span>}
        </div>
        <span className="text-xs text-slate-400">{formatRelativeDate(application.updated_at)}</span>
      </div>
    </div>
  );
}

function DraggableApplicationCard({ application, onOpen }: { application: ApplicationCard; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: application.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} onClick={onOpen} className={cn("cursor-grab touch-manipulation active:cursor-grabbing", isDragging && "opacity-30")}>
      <ApplicationCardContent application={application} />
    </div>
  );
}

function BoardColumn({ status, applications, onOpenApplication }: { status: ApplicationStatus; applications: ApplicationCard[]; onOpenApplication: (applicationId: number) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_ACCENT_CLASSES[status])} />
        <span className="text-sm font-semibold text-slate-700">{APPLICATION_STATUS_LABELS[status]}</span>
        <span className="rounded-full bg-slate-200/70 px-2 text-xs font-medium text-slate-600">{applications.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn("flex min-h-40 flex-1 flex-col gap-2.5 rounded-2xl bg-slate-100/80 p-2.5 transition-colors", isOver && "bg-brand-50 ring-2 ring-brand-300 ring-inset")}
      >
        {applications.map((application) => (
          <DraggableApplicationCard key={application.id} application={application} onOpen={() => onOpenApplication(application.id)} />
        ))}
        {applications.length === 0 && <div className="py-6 text-center text-xs text-slate-400">Drop here</div>}
      </div>
    </div>
  );
}

interface ApplicationKanbanBoardProperties {
  applications: ApplicationCard[];
  onMoveApplication: (applicationId: number, newStatus: ApplicationStatus) => void;
  onOpenApplication: (applicationId: number) => void;
}

// Drag cards between columns to update an application's status. Works with mouse and touch.
export function ApplicationKanbanBoard({ applications, onMoveApplication, onOpenApplication }: ApplicationKanbanBoardProperties) {
  const [draggedApplicationId, setDraggedApplicationId] = useState<number | null>(null);
  const dragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );
  const draggedApplication = applications.find((application) => application.id === draggedApplicationId);

  function handleDragStart(dragStartEvent: DragStartEvent) {
    setDraggedApplicationId(Number(dragStartEvent.active.id));
  }

  function handleDragEnd(dragEndEvent: DragEndEvent) {
    setDraggedApplicationId(null);
    const targetStatus = dragEndEvent.over?.id as ApplicationStatus | undefined;
    const movedApplication = applications.find((application) => application.id === Number(dragEndEvent.active.id));
    if (targetStatus && movedApplication && movedApplication.status !== targetStatus) {
      onMoveApplication(movedApplication.id, targetStatus);
    }
  }

  return (
    <DndContext sensors={dragSensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setDraggedApplicationId(null)}>
      <div className="scrollbar-thin -mx-4 flex gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        {APPLICATION_STATUS_ORDER.map((status) => (
          <BoardColumn
            key={status}
            status={status}
            applications={applications.filter((application) => application.status === status)}
            onOpenApplication={onOpenApplication}
          />
        ))}
      </div>
      <DragOverlay>{draggedApplication ? <ApplicationCardContent application={draggedApplication} isDragging /> : null}</DragOverlay>
    </DndContext>
  );
}
