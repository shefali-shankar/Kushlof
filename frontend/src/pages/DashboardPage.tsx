import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Briefcase, CheckCircle2, Columns3, FileText, Link2, Send, Sparkles, Upload, Workflow } from "lucide-react";
import { Link } from "react-router";

import { fetchDashboardSummary } from "@/api/settings";
import { STATUS_BADGE_TONES } from "@/components/board/applicationStatusStyles";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StatusDisplays";
import { formatRelativeDate } from "@/lib/formatters";
import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/types/application";

const QUICK_ACTIONS = [
  { to: "/resumes", icon: Upload, title: "Upload your CV", text: "Get an ATS score and suggestions" },
  { to: "/jobs?import=1", icon: Link2, title: "Paste a job link", text: "Import from LinkedIn or any site" },
  { to: "/jobs?fetch=1", icon: Briefcase, title: "Find jobs", text: "Search LinkedIn, Indeed and more" },
  { to: "/pipeline", icon: Workflow, title: "Run the pipeline", text: "Fetch, match and tailor in one go" },
];

function StatisticTile({ label, value, icon: TileIcon, tone }: { label: string; value: number; icon: typeof FileText; tone: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <div className={`rounded-lg p-2 ${tone}`}>
          <TileIcon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{value}</div>
    </Card>
  );
}

export default function DashboardPage({ username }: { username: string }) {
  const { data: dashboardSummary, isLoading, error } = useQuery({ queryKey: ["dashboard"], queryFn: fetchDashboardSummary });

  if (isLoading) return <LoadingState />;
  if (error || !dashboardSummary) return <ErrorState error={error} />;

  const statusCounts = dashboardSummary.application_counts_by_status;
  const appliedOrLater = (statusCounts.applied ?? 0) + (statusCounts.interview ?? 0) + (statusCounts.offer ?? 0);
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-600 to-violet-600 px-6 py-8 text-white shadow-lg shadow-brand-600/20 sm:px-8">
        <div className="pointer-events-none absolute -top-16 -right-10 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <p className="text-sm font-medium text-brand-100">{greeting}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Welcome back, {username}</h1>
        <p className="mt-2 max-w-xl text-sm text-brand-100">
          {dashboardSummary.resume_count === 0
            ? "Start by uploading your CV — Kushlof will score it and help you tailor it to every job."
            : `You have ${statusCounts.ready_to_apply ?? 0} application${statusCounts.ready_to_apply === 1 ? "" : "s"} ready to send.`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatisticTile label="CVs" value={dashboardSummary.resume_count} icon={FileText} tone="bg-brand-50 text-brand-600" />
        <StatisticTile label="Saved jobs" value={dashboardSummary.job_count} icon={Briefcase} tone="bg-sky-50 text-sky-600" />
        <StatisticTile label="Ready to apply" value={statusCounts.ready_to_apply ?? 0} icon={Send} tone="bg-amber-50 text-amber-600" />
        <StatisticTile label="Applied" value={appliedOrLater} icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {QUICK_ACTIONS.map(({ to, icon: ActionIcon, title, text }) => (
          <Link key={title} to={to} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
              <ActionIcon className="h-5 w-5" />
            </div>
            <div className="mt-4 font-semibold text-slate-900">{title}</div>
            <div className="mt-1 text-sm text-slate-500">{text}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader
            title="Recent applications"
            icon={<Columns3 className="h-4 w-4" />}
            actions={
              <Link to="/board" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700">
                Open board <ArrowRight className="h-4 w-4" />
              </Link>
            }
          />
          {dashboardSummary.recent_applications.length === 0 ? (
            <CardBody>
              <EmptyState
                className="border-0 py-8"
                icon={<Columns3 className="h-6 w-6" />}
                title="No applications yet"
                description="Save a job to your board to start tracking it."
              />
            </CardBody>
          ) : (
            <ul className="divide-y divide-slate-100">
              {dashboardSummary.recent_applications.map((application) => (
                <li key={application.id}>
                  <Link to={`/jobs/${application.job_id}`} className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-slate-50">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-900">{application.job_title}</div>
                      <div className="truncate text-sm text-slate-500">{application.company || "Unknown company"}</div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge tone={STATUS_BADGE_TONES[application.status as ApplicationStatus]}>
                        {APPLICATION_STATUS_LABELS[application.status as ApplicationStatus]}
                      </Badge>
                      <span className="text-xs text-slate-400">{formatRelativeDate(application.updated_at)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Last pipeline run" icon={<Sparkles className="h-4 w-4" />} />
          <CardBody>
            {dashboardSummary.latest_pipeline_run ? (
              <div className="space-y-3 text-sm">
                <Badge tone={dashboardSummary.latest_pipeline_run.status === "completed" ? "green" : dashboardSummary.latest_pipeline_run.status === "running" ? "brand" : "amber"}>
                  {dashboardSummary.latest_pipeline_run.status}
                </Badge>
                <p className="text-slate-600">{dashboardSummary.latest_pipeline_run.current_step}</p>
                <dl className="grid grid-cols-3 gap-2 text-center">
                  {[
                    ["Fetched", dashboardSummary.latest_pipeline_run.jobs_fetched],
                    ["Matched", dashboardSummary.latest_pipeline_run.jobs_matched],
                    ["Tailored", dashboardSummary.latest_pipeline_run.resumes_tailored],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-slate-50 p-2">
                      <dd className="text-lg font-semibold text-slate-900">{value}</dd>
                      <dt className="text-xs text-slate-500">{label}</dt>
                    </div>
                  ))}
                </dl>
                <p className="text-xs text-slate-400">{formatRelativeDate(dashboardSummary.latest_pipeline_run.started_at)}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                The pipeline only runs when you start it.{" "}
                <Link to="/pipeline" className="font-medium text-brand-600 hover:text-brand-700">Set it up →</Link>
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
