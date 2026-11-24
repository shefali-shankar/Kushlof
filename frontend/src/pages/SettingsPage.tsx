import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, CheckCircle2, Cpu, KeyRound, Lock, PlugZap, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { fetchAiProviders, fetchAiTaskAssignments, testAiConnection, updateAiProvider, updateAiTaskAssignment } from "@/api/settings";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, SelectInput, TextInput } from "@/components/ui/FormFields";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState, LoadingState } from "@/components/ui/StatusDisplays";
import { getErrorMessage } from "@/lib/formatters";
import type { AIProvider, AITaskAssignment } from "@/types/settings";

function ProviderSettingsCard({ provider }: { provider: AIProvider }) {
  const queryClient = useQueryClient();
  const [newApiKey, setNewApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(provider.base_url ?? "");

  const saveMutation = useMutation({
    mutationFn: (changes: { api_key?: string; base_url?: string }) => updateAiProvider(provider.name, changes),
    onSuccess: () => {
      setNewApiKey("");
      queryClient.invalidateQueries({ queryKey: ["ai-providers"] });
      toast.success(`${provider.display_name} saved.`);
    },
    onError: (saveError) => toast.error(getErrorMessage(saveError)),
  });

  const hasChanges = newApiKey.trim() !== "" || (provider.needs_base_url && baseUrl !== (provider.base_url ?? ""));
  const isReady = provider.needs_api_key ? provider.has_api_key : true;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-slate-900">{provider.display_name}</div>
          <p className="mt-0.5 text-sm text-slate-500">{provider.description}</p>
        </div>
        {isReady ? <Badge tone="green"><CheckCircle2 className="h-3 w-3" /> Ready</Badge> : <Badge tone="amber">Needs API key</Badge>}
      </div>
      {(provider.needs_api_key || provider.needs_base_url || provider.name === "custom_openai_compatible") && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {provider.needs_base_url && (
            <Field label="Server address">
              <TextInput value={baseUrl} onChange={(changeEvent) => setBaseUrl(changeEvent.target.value)} placeholder="http://127.0.0.1:11434" />
            </Field>
          )}
          {(provider.needs_api_key || provider.name === "custom_openai_compatible") && (
            <Field label="API key" hint={provider.has_api_key ? `Saved: ${provider.masked_api_key}. Enter a new key to replace it.` : "Stored encrypted on this computer."}>
              <TextInput type="password" autoComplete="off" value={newApiKey} onChange={(changeEvent) => setNewApiKey(changeEvent.target.value)} placeholder={provider.has_api_key ? "••••••••" : "Paste your API key"} />
            </Field>
          )}
        </div>
      )}
      {(hasChanges || provider.has_api_key) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {hasChanges && (
            <Button
              size="sm"
              isLoading={saveMutation.isPending}
              onClick={() => saveMutation.mutate({ ...(newApiKey.trim() ? { api_key: newApiKey.trim() } : {}), ...(provider.needs_base_url ? { base_url: baseUrl } : {}) })}
            >
              Save
            </Button>
          )}
          {provider.has_api_key && (
            <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => saveMutation.mutate({ api_key: "" })}>Remove key</Button>
          )}
        </div>
      )}
    </div>
  );
}

function TaskAssignmentRow({ taskAssignment, providers }: { taskAssignment: AITaskAssignment; providers: AIProvider[] }) {
  const queryClient = useQueryClient();
  const [providerName, setProviderName] = useState(taskAssignment.provider_name);
  const [modelName, setModelName] = useState(taskAssignment.model_name);
  const selectedProvider = providers.find((provider) => provider.name === providerName);
  const hasChanges = providerName !== taskAssignment.provider_name || modelName !== taskAssignment.model_name;

  const saveMutation = useMutation({
    mutationFn: () => updateAiTaskAssignment(taskAssignment.task_name, providerName, modelName),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ai-tasks"] }); toast.success(`${taskAssignment.display_name}: saved.`); },
    onError: (saveError) => toast.error(getErrorMessage(saveError)),
  });
  const testMutation = useMutation({ mutationFn: () => testAiConnection(providerName, modelName) });

  return (
    <div className="grid gap-3 px-5 py-4 lg:grid-cols-[1.2fr_1fr_1fr_auto] lg:items-end">
      <div>
        <div className="font-medium text-slate-900">{taskAssignment.display_name}</div>
        <div className="text-sm text-slate-500">{taskAssignment.description}</div>
      </div>
      <Field label="Provider">
        <SelectInput
          value={providerName}
          onChange={(changeEvent) => {
            const newProvider = providers.find((provider) => provider.name === changeEvent.target.value);
            setProviderName(changeEvent.target.value);
            setModelName(newProvider?.suggested_models[0] ?? "");
          }}
        >
          {providers.map((provider) => <option key={provider.name} value={provider.name}>{provider.display_name}</option>)}
        </SelectInput>
      </Field>
      <Field label="Model">
        <TextInput list={`models-${taskAssignment.task_name}`} value={modelName} onChange={(changeEvent) => setModelName(changeEvent.target.value)} />
        <datalist id={`models-${taskAssignment.task_name}`}>
          {selectedProvider?.suggested_models.map((suggestedModel) => <option key={suggestedModel} value={suggestedModel} />)}
        </datalist>
      </Field>
      <div className="flex gap-2">
        <Button size="md" variant="outline" isLoading={testMutation.isPending} disabled={!modelName} onClick={() => testMutation.mutate()}>
          {!testMutation.isPending && <PlugZap className="h-4 w-4" />} Test
        </Button>
        <Button size="md" disabled={!hasChanges || !modelName} isLoading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>Save</Button>
      </div>
      {testMutation.data && (
        <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm lg:col-span-4 ${testMutation.data.success ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          {testMutation.data.success ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          {testMutation.data.message}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const providersQuery = useQuery({ queryKey: ["ai-providers"], queryFn: fetchAiProviders });
  const tasksQuery = useQuery({ queryKey: ["ai-tasks"], queryFn: fetchAiTaskAssignments });

  if (providersQuery.isLoading || tasksQuery.isLoading) return <LoadingState />;
  if (providersQuery.error || tasksQuery.error) return <ErrorState error={providersQuery.error ?? tasksQuery.error} />;
  const providers = providersQuery.data ?? [];

  return (
    <div className="space-y-8">
      <PageHeader title="Settings" description="Choose which AI model handles each task, and connect your own providers." />

      <Card>
        <CardHeader title="Model for each task" icon={<Cpu className="h-4 w-4" />} description="Use a free local model for simple tasks and a stronger model for tailoring and cover letters." />
        <div className="divide-y divide-slate-100">
          {(tasksQuery.data ?? []).map((taskAssignment) => (
            <TaskAssignmentRow key={`${taskAssignment.task_name}-${taskAssignment.provider_name}-${taskAssignment.model_name}`} taskAssignment={taskAssignment} providers={providers} />
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="AI providers" icon={<Bot className="h-4 w-4" />} description="Add API keys for paid providers. Ollama and your Claude subscription need no key." />
        <CardBody className="grid gap-4 md:grid-cols-2">
          {providers.map((provider) => <ProviderSettingsCard key={provider.name} provider={provider} />)}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Privacy and security" icon={<Lock className="h-4 w-4" />} />
        <CardBody className="space-y-2 text-sm text-slate-600">
          <p className="flex gap-2"><KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /> API keys are encrypted and never shown again after saving.</p>
          <p className="flex gap-2"><Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /> Your CVs, jobs and applications are stored only on this computer, in the project's <code className="rounded bg-slate-100 px-1">data</code> folder.</p>
          <p className="flex gap-2"><Bot className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /> CV and job text is only sent to the AI provider you choose for each task.</p>
        </CardBody>
      </Card>
    </div>
  );
}
