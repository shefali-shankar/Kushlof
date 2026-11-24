import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Columns3 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { fetchApplications, updateApplication } from "@/api/applications";
import { ApplicationDetailsPanel } from "@/components/board/ApplicationDetailsPanel";
import { ApplicationKanbanBoard } from "@/components/board/ApplicationKanbanBoard";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StatusDisplays";
import { getErrorMessage } from "@/lib/formatters";
import { APPLICATION_STATUS_LABELS, type ApplicationCard, type ApplicationStatus } from "@/types/application";

export default function ApplicationBoardPage() {
  const queryClient = useQueryClient();
  const [openApplicationId, setOpenApplicationId] = useState<number | null>(null);
  const { data: applications, isLoading, error } = useQuery({ queryKey: ["applications"], queryFn: fetchApplications });

  const moveMutation = useMutation({
    mutationFn: ({ applicationId, newStatus }: { applicationId: number; newStatus: ApplicationStatus }) =>
      updateApplication(applicationId, { status: newStatus }),
    // Move the card immediately, and put it back if saving fails.
    onMutate: async ({ applicationId, newStatus }) => {
      await queryClient.cancelQueries({ queryKey: ["applications"] });
      const previousApplications = queryClient.getQueryData<ApplicationCard[]>(["applications"]);
      queryClient.setQueryData<ApplicationCard[]>(["applications"], (currentApplications = []) =>
        currentApplications.map((application) => (application.id === applicationId ? { ...application, status: newStatus } : application)),
      );
      return { previousApplications };
    },
    onError: (moveError, _variables, mutationContext) => {
      queryClient.setQueryData(["applications"], mutationContext?.previousApplications);
      toast.error(getErrorMessage(moveError));
    },
    onSuccess: (_updatedApplication, { newStatus }) => toast.success(`Moved to ${APPLICATION_STATUS_LABELS[newStatus]}.`),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  return (
    <div>
      <PageHeader
        title="Applications"
        description="Drag cards between columns as your applications progress. Click a card for documents, notes and history."
      />
      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} />}
      {applications && applications.length === 0 && (
        <EmptyState
          icon={<Columns3 className="h-6 w-6" />}
          title="Your board is empty"
          description="Open a job and click “Save to board”, or tailor a CV to a job — it will appear here automatically."
          action={<Link to="/jobs"><Button><Briefcase className="h-4 w-4" /> Browse jobs</Button></Link>}
        />
      )}
      {applications && applications.length > 0 && (
        <ApplicationKanbanBoard
          applications={applications}
          onMoveApplication={(applicationId, newStatus) => moveMutation.mutate({ applicationId, newStatus })}
          onOpenApplication={setOpenApplicationId}
        />
      )}
      <ApplicationDetailsPanel applicationId={openApplicationId} onClose={() => setOpenApplicationId(null)} />
    </div>
  );
}
