import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Columns3, FileText, Sparkles, Target } from "lucide-react";
import { type FormEvent, useState } from "react";

import { signIn } from "@/api/auth";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/FormFields";
import { SESSION_QUERY_KEY } from "@/hooks/useSession";
import { getErrorMessage } from "@/lib/formatters";

const PRODUCT_HIGHLIGHTS = [
  { icon: Target, title: "Tailor in one click", text: "Match your CV to any job while keeping every fact true." },
  { icon: Sparkles, title: "ATS score and fixes", text: "See your score and exactly what to improve, section by section." },
  { icon: FileText, title: "Cover letters", text: "Specific, professional letters written from your real experience." },
  { icon: Columns3, title: "Track every application", text: "A board from Saved to Offer, so nothing slips through." },
];

export default function SignInPage({ isFirstRun }: { isFirstRun: boolean }) {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleFormSubmit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await signIn(username.trim());
      await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    } catch (signInError) {
      setErrorMessage(getErrorMessage(signInError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-slate-950 px-12 py-14 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-brand-600/40 blur-3xl" />
        <div className="pointer-events-none absolute right-0 bottom-0 h-80 w-80 rounded-full bg-violet-600/30 blur-3xl" />
        <BrandLogo nameClassName="text-white" className="relative" />
        <div className="relative mt-auto max-w-lg">
          <h1 className="text-4xl leading-tight font-semibold tracking-tight">
            Land interviews faster with a CV that fits every job.
          </h1>
          <p className="mt-4 text-slate-400">Your personal job application assistant — private, on your own computer.</p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {PRODUCT_HIGHLIGHTS.map(({ icon: HighlightIcon, title, text }) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <HighlightIcon className="h-5 w-5 text-brand-300" />
                <div className="mt-3 text-sm font-semibold">{title}</div>
                <div className="mt-1 text-sm text-slate-400">{text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <form onSubmit={handleFormSubmit} className="w-full max-w-sm">
          <BrandLogo className="mb-10 lg:hidden" />
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            {isFirstRun ? "Welcome to Kushlof" : "Welcome back"}
          </h2>
          <p className="mt-1.5 text-sm text-slate-500">
            {isFirstRun ? "Choose a username to set up your workspace." : "Enter your username to continue."}
          </p>

          <Field label="Username" className="mt-8">
            <TextInput
              value={username}
              onChange={(changeEvent) => setUsername(changeEvent.target.value)}
              placeholder="e.g. shef"
              autoComplete="username"
              autoFocus
              required
              minLength={2}
              maxLength={64}
            />
          </Field>

          {errorMessage && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>}

          <Button type="submit" size="lg" isLoading={isSubmitting} className="mt-6 w-full">
            {isFirstRun ? "Get started" : "Continue"}
            {!isSubmitting && <ArrowRight className="h-4 w-4" />}
          </Button>
          <p className="mt-6 text-center text-xs text-slate-400">Your data stays on this computer.</p>
        </form>
      </section>
    </div>
  );
}
