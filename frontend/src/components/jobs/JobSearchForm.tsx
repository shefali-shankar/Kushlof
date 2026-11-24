import { Checkbox, Field, SelectInput, TextInput } from "@/components/ui/FormFields";
import { cn } from "@/lib/classNames";
import { JOB_SITE_LABELS, type FetchJobsRequest, type JobSiteName } from "@/types/job";

export const DEFAULT_JOB_SEARCH: FetchJobsRequest = {
  search_term: "",
  location: "",
  country: "Australia",
  sites: ["linkedin", "indeed"],
  results_wanted: 20,
  hours_old: 72,
  is_remote: false,
};

const COUNTRY_OPTIONS = ["Australia", "New Zealand", "UK", "USA", "Canada", "India", "Singapore", "Ireland", "Germany"];

// The fields for a job-site search, shared by "Fetch jobs" and the pipeline's saved searches.
export function JobSearchForm({ searchSettings, onChange }: { searchSettings: FetchJobsRequest; onChange: (updated: FetchJobsRequest) => void }) {
  function toggleSite(siteName: JobSiteName) {
    const updatedSites = searchSettings.sites.includes(siteName)
      ? searchSettings.sites.filter((existingSite) => existingSite !== siteName)
      : [...searchSettings.sites, siteName];
    onChange({ ...searchSettings, sites: updatedSites });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Job title or keywords">
          <TextInput value={searchSettings.search_term} placeholder="e.g. Data Analyst" required onChange={(changeEvent) => onChange({ ...searchSettings, search_term: changeEvent.target.value })} />
        </Field>
        <Field label="Location">
          <TextInput value={searchSettings.location} placeholder="e.g. Sydney, NSW" onChange={(changeEvent) => onChange({ ...searchSettings, location: changeEvent.target.value })} />
        </Field>
        <Field label="Country" hint="Used by Indeed and Glassdoor.">
          <SelectInput value={searchSettings.country} onChange={(changeEvent) => onChange({ ...searchSettings, country: changeEvent.target.value })}>
            {COUNTRY_OPTIONS.map((countryName) => <option key={countryName}>{countryName}</option>)}
          </SelectInput>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="How many">
            <SelectInput value={searchSettings.results_wanted} onChange={(changeEvent) => onChange({ ...searchSettings, results_wanted: Number(changeEvent.target.value) })}>
              {[10, 20, 30, 50].map((resultCount) => <option key={resultCount} value={resultCount}>{resultCount}</option>)}
            </SelectInput>
          </Field>
          <Field label="Posted within">
            <SelectInput value={searchSettings.hours_old} onChange={(changeEvent) => onChange({ ...searchSettings, hours_old: Number(changeEvent.target.value) })}>
              <option value={24}>1 day</option>
              <option value={72}>3 days</option>
              <option value={168}>1 week</option>
              <option value={720}>1 month</option>
            </SelectInput>
          </Field>
        </div>
      </div>
      <div>
        <span className="mb-2 block text-sm font-medium text-slate-700">Job sites</span>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(JOB_SITE_LABELS) as JobSiteName[]).map((siteName) => (
            <button
              key={siteName}
              type="button"
              onClick={() => toggleSite(siteName)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                searchSettings.sites.includes(siteName) ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
              )}
            >
              {JOB_SITE_LABELS[siteName]}
            </button>
          ))}
        </div>
      </div>
      <Checkbox label="Remote jobs only" checked={searchSettings.is_remote} onChange={(isChecked) => onChange({ ...searchSettings, is_remote: isChecked })} />
    </div>
  );
}
