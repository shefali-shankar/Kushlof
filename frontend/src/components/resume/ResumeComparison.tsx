import type { ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { ResumeContent } from "@/types/resume";

function ComparisonColumns({ beforeContent, afterContent }: { beforeContent: ReactNode; afterContent: ReactNode }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-xl bg-slate-50 p-4">
        <div className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Before</div>
        {beforeContent}
      </div>
      <div className="rounded-xl bg-emerald-50/60 p-4 ring-1 ring-emerald-100">
        <div className="mb-2 text-xs font-semibold tracking-wide text-emerald-700 uppercase">After</div>
        {afterContent}
      </div>
    </div>
  );
}

function BulletList({ bullets }: { bullets: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
      {bullets.map((bullet, bulletIndex) => <li key={bulletIndex}>{bullet}</li>)}
    </ul>
  );
}

// Side-by-side view of what tailoring changed: summary, skills order and each job's bullet points.
export function ResumeComparison({ originalContent, tailoredContent }: { originalContent: ResumeContent; tailoredContent: ResumeContent }) {
  const originalSkills = originalContent.skills.flatMap((skillGroup) => skillGroup.keywords);
  const tailoredSkills = tailoredContent.skills.flatMap((skillGroup) => skillGroup.keywords);

  return (
    <div className="space-y-4">
      {originalContent.summary !== tailoredContent.summary && (
        <Card>
          <CardHeader title="Summary" />
          <CardBody>
            <ComparisonColumns
              beforeContent={<p className="text-sm leading-relaxed text-slate-700">{originalContent.summary || "—"}</p>}
              afterContent={<p className="text-sm leading-relaxed text-slate-700">{tailoredContent.summary || "—"}</p>}
            />
          </CardBody>
        </Card>
      )}

      {tailoredContent.work.map((tailoredJob, jobIndex) => {
        const originalJob = originalContent.work[jobIndex];
        if (!originalJob || JSON.stringify(originalJob.highlights) === JSON.stringify(tailoredJob.highlights)) return null;
        return (
          <Card key={jobIndex}>
            <CardHeader title={tailoredJob.position} description={tailoredJob.company} />
            <CardBody>
              <ComparisonColumns beforeContent={<BulletList bullets={originalJob.highlights} />} afterContent={<BulletList bullets={tailoredJob.highlights} />} />
            </CardBody>
          </Card>
        );
      })}

      {JSON.stringify(originalSkills) !== JSON.stringify(tailoredSkills) && (
        <Card>
          <CardHeader title="Skills" description="Reordered so the most relevant come first" />
          <CardBody>
            <ComparisonColumns
              beforeContent={<div className="flex flex-wrap gap-1.5">{originalSkills.map((skill) => <Badge key={skill}>{skill}</Badge>)}</div>}
              afterContent={<div className="flex flex-wrap gap-1.5">{tailoredSkills.map((skill) => <Badge key={skill} tone="green">{skill}</Badge>)}</div>}
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
