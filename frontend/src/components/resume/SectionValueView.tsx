import type { Project, ResumeSectionName, SkillGroup, WorkExperience } from "@/types/resume";

// Shows a CV section's content as readable text (used to compare an AI proposal with the original).
export function SectionValueView({ section, value }: { section: ResumeSectionName; value: unknown }) {
  if (section === "summary") {
    return <p className="text-sm leading-relaxed whitespace-pre-line text-slate-700">{String(value ?? "")}</p>;
  }
  if (section === "work") {
    return (
      <div className="space-y-3">
        {(value as WorkExperience[]).map((job, jobIndex) => (
          <div key={jobIndex}>
            <div className="text-sm font-semibold text-slate-900">
              {job.position} · {job.company}
            </div>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {job.highlights.map((bullet, bulletIndex) => (
                <li key={bulletIndex}>{bullet}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }
  if (section === "skills") {
    return (
      <div className="space-y-1.5 text-sm text-slate-700">
        {(value as SkillGroup[]).map((skillGroup, groupIndex) => (
          <div key={groupIndex}>
            {skillGroup.name && <span className="font-semibold text-slate-900">{skillGroup.name}: </span>}
            {skillGroup.keywords.join(", ")}
          </div>
        ))}
      </div>
    );
  }
  if (section === "projects") {
    return (
      <div className="space-y-3">
        {(value as Project[]).map((project, projectIndex) => (
          <div key={projectIndex} className="text-sm text-slate-700">
            <div className="font-semibold text-slate-900">{project.name}</div>
            {project.description && <p>{project.description}</p>}
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {project.highlights.map((bullet, bulletIndex) => (
                <li key={bulletIndex}>{bullet}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }
  return <pre className="text-xs whitespace-pre-wrap text-slate-600">{JSON.stringify(value, null, 2)}</pre>;
}
