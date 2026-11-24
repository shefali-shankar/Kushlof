import { Compass } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/StatusDisplays";

export default function NotFoundPage() {
  return (
    <EmptyState
      className="mt-10"
      icon={<Compass className="h-6 w-6" />}
      title="Page not found"
      description="That page doesn't exist. It may have been moved or deleted."
      action={<Link to="/"><Button>Back to dashboard</Button></Link>}
    />
  );
}
