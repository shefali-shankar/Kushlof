import { Award, Briefcase, ChevronDown, FolderGit2, GraduationCap, Plus, Sparkles, User, Wrench, AlignLeft } from "lucide-react";
import { type ReactNode, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, TextArea, TextInput } from "@/components/ui/FormFields";
import { cn } from "@/lib/classNames";
import type {
  Certification,
  Education,
  Project,
  ResumeBasics,
  ResumeContent,
  ResumeSectionName,
  SkillGroup,
  SuggestionSection,
  WorkExperience,
} from "@/types/resume";

import { BulletListEditor, EntryActions, moveItem, removeItemAt, replaceItemAt, TagInput } from "./ListEditingControls";

export const SECTIONS_WITH_AI_REWRITE: ResumeSectionName[] = ["summary", "work", "skills", "projects"];

interface SectionCardProperties {
  sectionKey: SuggestionSection;
  title: string;
  icon: ReactNode;
  isHighlighted: boolean;
  onImproveWithAi?: () => void;
  children: ReactNode;
}

// A collapsible card around one CV section. Its id lets suggestions scroll to it.
function SectionCard({ sectionKey, title, icon, isHighlighted, onImproveWithAi, children }: SectionCardProperties) {
  const [isExpanded, setIsExpanded] = useState(true);
  return (
    <section
      id={`resume-section-${sectionKey}`}
      className={cn(
        "scroll-mt-24 rounded-2xl border bg-white shadow-[var(--shadow-card)] transition-shadow",
        isHighlighted ? "border-brand-400 ring-4 ring-brand-100" : "border-slate-200/80",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-5 py-3.5">
        <button type="button" onClick={() => setIsExpanded(!isExpanded)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="rounded-lg bg-brand-50 p-1.5 text-brand-600">{icon}</span>
          <span className="font-semibold text-slate-900">{title}</span>
          <ChevronDown className={cn("h-4 w-4 text-slate-400 transition", !isExpanded && "-rotate-90")} />
        </button>
        {onImproveWithAi && (
          <Button variant="secondary" size="sm" onClick={onImproveWithAi}>
            <Sparkles className="h-4 w-4" /> Improve with AI
          </Button>
        )}
      </div>
      {isExpanded && <div className="space-y-4 border-t border-slate-100 px-5 py-4">{children}</div>}
    </section>
  );
}

function EntryBox({ heading, actions, children }: { heading: string; actions: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold text-slate-700">{heading}</span>
        {actions}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

const EMPTY_WORK_ENTRY: WorkExperience = { company: "", position: "", location: "", start_date: "", end_date: "", highlights: [""] };
const EMPTY_EDUCATION_ENTRY: Education = { institution: "", degree: "", field_of_study: "", start_date: "", end_date: "", grade: "" };
const EMPTY_PROJECT_ENTRY: Project = { name: "", description: "", url: "", highlights: [] };
const EMPTY_CERTIFICATION_ENTRY: Certification = { name: "", issuer: "", date: "" };
const EMPTY_SKILL_GROUP: SkillGroup = { name: "", keywords: [] };

interface ResumeEditorProperties {
  content: ResumeContent;
  onContentChange: (updatedContent: ResumeContent) => void;
  highlightedSection: SuggestionSection | null;
  onImproveSection: (section: ResumeSectionName) => void;
}

// The full set of section editors for a CV.
export function ResumeEditor({ content, onContentChange, highlightedSection, onImproveSection }: ResumeEditorProperties) {
  function updateBasics(fieldName: keyof ResumeBasics, fieldValue: string) {
    onContentChange({ ...content, basics: { ...content.basics, [fieldName]: fieldValue } });
  }
  function updateSection<SectionName extends keyof ResumeContent>(sectionName: SectionName, sectionValue: ResumeContent[SectionName]) {
    onContentChange({ ...content, [sectionName]: sectionValue });
  }

  const basicsFields: { key: keyof ResumeBasics; label: string; placeholder: string }[] = [
    { key: "name", label: "Full name", placeholder: "Alex Taylor" },
    { key: "headline", label: "Headline", placeholder: "Senior Data Analyst" },
    { key: "email", label: "Email", placeholder: "alex@example.com" },
    { key: "phone", label: "Phone", placeholder: "+61 400 000 000" },
    { key: "location", label: "Location", placeholder: "Sydney, NSW" },
    { key: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/alextaylor" },
    { key: "website", label: "Website / portfolio", placeholder: "alextaylor.dev" },
  ];

  return (
    <div className="space-y-4">
      <SectionCard sectionKey="basics" title="Contact details" icon={<User className="h-4 w-4" />} isHighlighted={highlightedSection === "basics"}>
        <div className="grid gap-3 sm:grid-cols-2">
          {basicsFields.map(({ key, label, placeholder }) => (
            <Field key={key} label={label}>
              <TextInput value={content.basics[key]} placeholder={placeholder} onChange={(changeEvent) => updateBasics(key, changeEvent.target.value)} />
            </Field>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        sectionKey="summary"
        title="Professional summary"
        icon={<AlignLeft className="h-4 w-4" />}
        isHighlighted={highlightedSection === "summary"}
        onImproveWithAi={() => onImproveSection("summary")}
      >
        <TextArea
          rows={5}
          value={content.summary}
          placeholder="2–4 sentences on your experience, strengths and what you're looking for."
          onChange={(changeEvent) => updateSection("summary", changeEvent.target.value)}
        />
        <p className="text-xs text-slate-400">{content.summary.split(/\s+/).filter(Boolean).length} words</p>
      </SectionCard>

      <SectionCard
        sectionKey="work"
        title="Work experience"
        icon={<Briefcase className="h-4 w-4" />}
        isHighlighted={highlightedSection === "work"}
        onImproveWithAi={() => onImproveSection("work")}
      >
        {content.work.map((job, jobIndex) => (
          <EntryBox
            key={jobIndex}
            heading={job.position || job.company ? `${job.position}${job.company ? ` · ${job.company}` : ""}` : "New role"}
            actions={
              <EntryActions
                onMoveUp={() => updateSection("work", moveItem(content.work, jobIndex, jobIndex - 1))}
                onMoveDown={() => updateSection("work", moveItem(content.work, jobIndex, jobIndex + 1))}
                onRemove={() => updateSection("work", removeItemAt(content.work, jobIndex))}
              />
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {(["position", "company", "location"] as const).map((fieldName) => (
                <Field key={fieldName} label={fieldName === "position" ? "Job title" : fieldName === "company" ? "Company" : "Location"}>
                  <TextInput
                    value={job[fieldName]}
                    onChange={(changeEvent) => updateSection("work", replaceItemAt(content.work, jobIndex, { ...job, [fieldName]: changeEvent.target.value }))}
                  />
                </Field>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start">
                  <TextInput value={job.start_date} placeholder="Mar 2021" onChange={(changeEvent) => updateSection("work", replaceItemAt(content.work, jobIndex, { ...job, start_date: changeEvent.target.value }))} />
                </Field>
                <Field label="End">
                  <TextInput value={job.end_date} placeholder="Present" onChange={(changeEvent) => updateSection("work", replaceItemAt(content.work, jobIndex, { ...job, end_date: changeEvent.target.value }))} />
                </Field>
              </div>
            </div>
            <div>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Achievements</span>
              <BulletListEditor bullets={job.highlights} onChange={(updatedBullets) => updateSection("work", replaceItemAt(content.work, jobIndex, { ...job, highlights: updatedBullets }))} />
            </div>
          </EntryBox>
        ))}
        <Button variant="outline" size="sm" onClick={() => updateSection("work", [...content.work, { ...EMPTY_WORK_ENTRY }])}>
          <Plus className="h-4 w-4" /> Add role
        </Button>
      </SectionCard>

      <SectionCard
        sectionKey="skills"
        title="Skills"
        icon={<Wrench className="h-4 w-4" />}
        isHighlighted={highlightedSection === "skills"}
        onImproveWithAi={() => onImproveSection("skills")}
      >
        {content.skills.map((skillGroup, groupIndex) => (
          <div key={groupIndex} className="grid gap-2 sm:grid-cols-[180px_1fr_auto] sm:items-start">
            <TextInput
              value={skillGroup.name}
              placeholder="Group, e.g. Technical"
              onChange={(changeEvent) => updateSection("skills", replaceItemAt(content.skills, groupIndex, { ...skillGroup, name: changeEvent.target.value }))}
            />
            <TagInput
              tags={skillGroup.keywords}
              placeholder="Type a skill and press Enter"
              onChange={(updatedSkills) => updateSection("skills", replaceItemAt(content.skills, groupIndex, { ...skillGroup, keywords: updatedSkills }))}
            />
            <EntryActions
              onMoveUp={() => updateSection("skills", moveItem(content.skills, groupIndex, groupIndex - 1))}
              onMoveDown={() => updateSection("skills", moveItem(content.skills, groupIndex, groupIndex + 1))}
              onRemove={() => updateSection("skills", removeItemAt(content.skills, groupIndex))}
            />
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => updateSection("skills", [...content.skills, { ...EMPTY_SKILL_GROUP }])}>
          <Plus className="h-4 w-4" /> Add skill group
        </Button>
      </SectionCard>

      <SectionCard
        sectionKey="projects"
        title="Projects"
        icon={<FolderGit2 className="h-4 w-4" />}
        isHighlighted={highlightedSection === "projects"}
        onImproveWithAi={content.projects.length ? () => onImproveSection("projects") : undefined}
      >
        {content.projects.map((project, projectIndex) => (
          <EntryBox
            key={projectIndex}
            heading={project.name || "New project"}
            actions={
              <EntryActions
                onMoveUp={() => updateSection("projects", moveItem(content.projects, projectIndex, projectIndex - 1))}
                onMoveDown={() => updateSection("projects", moveItem(content.projects, projectIndex, projectIndex + 1))}
                onRemove={() => updateSection("projects", removeItemAt(content.projects, projectIndex))}
              />
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <TextInput value={project.name} onChange={(changeEvent) => updateSection("projects", replaceItemAt(content.projects, projectIndex, { ...project, name: changeEvent.target.value }))} />
              </Field>
              <Field label="Link">
                <TextInput value={project.url} onChange={(changeEvent) => updateSection("projects", replaceItemAt(content.projects, projectIndex, { ...project, url: changeEvent.target.value }))} />
              </Field>
            </div>
            <Field label="Description">
              <TextArea rows={2} value={project.description} onChange={(changeEvent) => updateSection("projects", replaceItemAt(content.projects, projectIndex, { ...project, description: changeEvent.target.value }))} />
            </Field>
            <BulletListEditor bullets={project.highlights} onChange={(updatedBullets) => updateSection("projects", replaceItemAt(content.projects, projectIndex, { ...project, highlights: updatedBullets }))} />
          </EntryBox>
        ))}
        <Button variant="outline" size="sm" onClick={() => updateSection("projects", [...content.projects, { ...EMPTY_PROJECT_ENTRY }])}>
          <Plus className="h-4 w-4" /> Add project
        </Button>
      </SectionCard>

      <SectionCard sectionKey="education" title="Education" icon={<GraduationCap className="h-4 w-4" />} isHighlighted={highlightedSection === "education"}>
        {content.education.map((qualification, qualificationIndex) => (
          <EntryBox
            key={qualificationIndex}
            heading={qualification.degree || qualification.institution || "New qualification"}
            actions={
              <EntryActions
                onMoveUp={() => updateSection("education", moveItem(content.education, qualificationIndex, qualificationIndex - 1))}
                onMoveDown={() => updateSection("education", moveItem(content.education, qualificationIndex, qualificationIndex + 1))}
                onRemove={() => updateSection("education", removeItemAt(content.education, qualificationIndex))}
              />
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["degree", "Degree"],
                  ["field_of_study", "Field of study"],
                  ["institution", "Institution"],
                  ["grade", "Grade (optional)"],
                  ["start_date", "Start"],
                  ["end_date", "End"],
                ] as const
              ).map(([fieldName, fieldLabel]) => (
                <Field key={fieldName} label={fieldLabel}>
                  <TextInput
                    value={qualification[fieldName]}
                    onChange={(changeEvent) =>
                      updateSection("education", replaceItemAt(content.education, qualificationIndex, { ...qualification, [fieldName]: changeEvent.target.value }))
                    }
                  />
                </Field>
              ))}
            </div>
          </EntryBox>
        ))}
        <Button variant="outline" size="sm" onClick={() => updateSection("education", [...content.education, { ...EMPTY_EDUCATION_ENTRY }])}>
          <Plus className="h-4 w-4" /> Add qualification
        </Button>
      </SectionCard>

      <SectionCard sectionKey="certifications" title="Certifications" icon={<Award className="h-4 w-4" />} isHighlighted={highlightedSection === "certifications"}>
        {content.certifications.map((certification, certificationIndex) => (
          <div key={certificationIndex} className="grid gap-2 sm:grid-cols-[2fr_1.5fr_1fr_auto] sm:items-center">
            {(["name", "issuer", "date"] as const).map((fieldName) => (
              <TextInput
                key={fieldName}
                value={certification[fieldName]}
                placeholder={fieldName === "name" ? "Certificate" : fieldName === "issuer" ? "Issuer" : "Year"}
                onChange={(changeEvent) =>
                  updateSection("certifications", replaceItemAt(content.certifications, certificationIndex, { ...certification, [fieldName]: changeEvent.target.value }))
                }
              />
            ))}
            <EntryActions
              onMoveUp={() => updateSection("certifications", moveItem(content.certifications, certificationIndex, certificationIndex - 1))}
              onMoveDown={() => updateSection("certifications", moveItem(content.certifications, certificationIndex, certificationIndex + 1))}
              onRemove={() => updateSection("certifications", removeItemAt(content.certifications, certificationIndex))}
            />
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => updateSection("certifications", [...content.certifications, { ...EMPTY_CERTIFICATION_ENTRY }])}>
          <Plus className="h-4 w-4" /> Add certification
        </Button>
      </SectionCard>
    </div>
  );
}
