import { BrowserRouter, Route, Routes } from "react-router";

import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorState, LoadingState } from "@/components/ui/StatusDisplays";
import { useSession } from "@/hooks/useSession";
import ApplicationBoardPage from "@/pages/ApplicationBoardPage";
import CoverLetterPage from "@/pages/CoverLetterPage";
import DashboardPage from "@/pages/DashboardPage";
import JobDetailsPage from "@/pages/JobDetailsPage";
import JobsPage from "@/pages/JobsPage";
import NotFoundPage from "@/pages/NotFoundPage";
import PipelinePage from "@/pages/PipelinePage";
import ResumesPage from "@/pages/ResumesPage";
import ResumeStudioPage from "@/pages/ResumeStudioPage";
import SettingsPage from "@/pages/SettingsPage";
import SignInPage from "@/pages/SignInPage";
import TailoringResultPage from "@/pages/TailoringResultPage";

// Shows the sign-in page until the user is signed in, then the full app.
export default function App() {
  const { data: sessionStatus, isLoading, error } = useSession();

  if (isLoading) return <LoadingState message="Starting Kushlof…" className="min-h-dvh" />;
  if (error || !sessionStatus) {
    return (
      <div className="mx-auto max-w-md p-6 pt-24">
        <ErrorState error={new Error("Cannot reach the Kushlof backend. Make sure it is running (start_development_servers.ps1).")} />
      </div>
    );
  }
  if (!sessionStatus.is_signed_in) return <SignInPage isFirstRun={!sessionStatus.profile_exists} />;

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout username={sessionStatus.username ?? ""} />}>
          <Route index element={<DashboardPage username={sessionStatus.username ?? ""} />} />
          <Route path="jobs" element={<JobsPage />} />
          <Route path="jobs/:jobId" element={<JobDetailsPage />} />
          <Route path="jobs/:jobId/tailored/:resumeId" element={<TailoringResultPage />} />
          <Route path="resumes" element={<ResumesPage />} />
          <Route path="resumes/:resumeId" element={<ResumeStudioPage />} />
          <Route path="cover-letters/:coverLetterId" element={<CoverLetterPage />} />
          <Route path="board" element={<ApplicationBoardPage />} />
          <Route path="pipeline" element={<PipelinePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
