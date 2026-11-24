# Kushlof

A personal job application assistant. Upload your CV, get an ATS score with fixes, tailor it to any job in one click (without inventing anything), write cover letters, find matching jobs, and track every application on a board.

Everything runs on your own computer. Your data stays in the local `data/` folder.

## Features
| Area | What you can do |
|---|---|
| **My CVs** | Upload a PDF/Word CV (AI splits it into sections), edit each section, see a live preview, choose a design, download PDF or Word |
| **CV improvement** | ATS score (keywords, formatting, content), clickable suggestions that jump to the section, "Improve with AI" for any section, AI expert review |
| **Jobs** | Fetch jobs from LinkedIn, Indeed, Glassdoor, Google Jobs and ZipRecruiter; import any job by link (or pasted text); AI analysis of required skills |
| **Matching** | Rank saved jobs by how well they fit your CV; search new jobs using your CV's job title |
| **Tailoring** | Tailored copy of your CV per job, before/after ATS score, side-by-side changes, warnings for anything to double-check |
| **Cover letters** | AI-written, editable, PDF/Word export |
| **Applications board** | Drag-and-drop Kanban from Saved → Offer, notes, documents, history, "Apply now" |
| **Pipeline** | You press Start: fetch → match → tailor → "Ready to apply". Never scheduled, never submits for you |
| **Settings** | Choose the AI model per task: Ollama (free, local), your Claude subscription (via Claude Code), or API keys for Anthropic, OpenAI, Gemini, Groq, OpenRouter or any OpenAI-compatible server |

## Requirements
- [uv](https://docs.astral.sh/uv/) — installs Python 3.12 automatically (`winget install astral-sh.uv`)
- Node.js 20 or newer
- At least one AI option:
  - [Ollama](https://ollama.com) for free local models (`ollama pull qwen3:4b`), and/or
  - [Claude Code](https://claude.com/claude-code), signed in with your Claude plan, and/or
  - An API key for a cloud provider (add it in **Settings**)

## Setup (once)
```powershell
cd C:\Users\User\Documents\Projects\Kushlof_Job_App
.\setup_project.ps1
```
This creates `backend\.venv` (Python 3.12), installs `backend\requirements-dev.txt`, downloads Chromium for PDF export, and runs `npm install` for the frontend.

<details>
<summary>Manual setup instead of the script</summary>

```powershell
cd backend
uv venv --python 3.12                     # skip if backend\.venv already exists
uv pip install --python .venv\Scripts\python.exe -r requirements-dev.txt
.venv\Scripts\python.exe -m playwright install chromium
cd ..\frontend
npm install
```
</details>

## Run
```powershell
.\start_development_servers.ps1
```
Open http://localhost:5173 and sign in with any username. The first username becomes your profile.

## Check everything (tests, linters, vulnerability scans)
```powershell
.\run_security_checks.ps1
```

## Project structure
```
Kushlof_Job_App/
├── backend/                     Python (FastAPI)
│   ├── requirements.txt         App libraries
│   ├── requirements-dev.txt     + test and security tools
│   ├── app/
│   │   ├── main.py              Creates the app, middleware, error handling
│   │   ├── api/
│   │   │   ├── router.py        Combines routes; everything except sign-in requires a session
│   │   │   ├── dependencies.py  Database session, signed-in user
│   │   │   └── routes/          One file per area: auth, resumes, jobs, applications, cover_letters, ai_settings, pipeline, dashboard
│   │   ├── core/                Config, database, sessions, HTTP security, encryption, safe URL fetching, upload validation
│   │   ├── models/              Database tables
│   │   ├── schemas/             API request/response shapes and the structured CV format
│   │   ├── services/
│   │   │   ├── ai/              Provider interface, Ollama / Claude Code / Anthropic / OpenAI-compatible providers, prompts
│   │   │   ├── resumes/         Text extraction, parsing, ATS scoring, tailoring, improving, fact protection, rendering, export
│   │   │   ├── jobs/            jobspy fetching, link import, requirement extraction, job matching
│   │   │   ├── cover_letters/   Cover letter writing
│   │   │   ├── applications/    Board status changes
│   │   │   └── pipeline/        The manual-trigger pipeline
│   │   └── templates/           CV and cover letter HTML designs
│   └── tests/
├── frontend/                    React + TypeScript + Tailwind (Vite)
│   ├── package.json
│   └── src/
│       ├── api/                 Functions that call the backend (one file per area)
│       ├── components/          ui/ (buttons, cards, dialogs…), layout/, resume/, jobs/, board/
│       ├── pages/               One file per screen
│       ├── hooks/  lib/  types/
│       └── main.tsx, App.tsx
├── data/                        Your database (never committed)
├── setup_project.ps1  start_development_servers.ps1  run_security_checks.ps1
└── .env                         Generated secrets (never committed)
```

## Security notes
- Kushlof only accepts connections from this computer by default (`ALLOW_NETWORK_ACCESS=false`).
- **Sign-in uses only a username**, which is fine while Kushlof is limited to your own computer. Before turning on network access (for example for your phone), add password protection back.
- Sessions use HttpOnly, SameSite=Strict cookies; only a hash of each session token is stored.
- Every API change request must include the `X-Requested-With: Kushlof` header (CSRF protection).
- API keys are encrypted at rest and never returned to the browser.
- Uploaded files are checked by content (PDF/DOCX only, 10 MB, zip-bomb protection) and are not kept after reading.
- Job links are fetched with SSRF protection (no private or local addresses, redirects re-checked, size and time limits).
- CV and job text is treated as data in every AI prompt. Claude Code runs with all tools disabled in an empty folder.
- After every AI edit, employers, titles, dates, education and certifications are restored from your original, invented skills are removed, and new numbers are flagged for you to check.
- PDFs are rendered with JavaScript and network access disabled.
- A test fails if any API route is added without sign-in protection.
