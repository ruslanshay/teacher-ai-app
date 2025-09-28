
# Teacher AI (Privacy-First) — v0.2.0

A web app scaffold that gives teachers a safe, flexible interface for using AI with **global buttons**, **custom topics**, **curriculum/grade selectors**, **editable prompts**, **profiles**, **history**, and a **canvas-like selection editor**.
Built with Next.js + TypeScript.

**What’s new in v0.2.0**
- Buttons are **global** (not tied to a topic)
- Removed preset topics; add your own
- Preset **buttons** on first run: Lesson plan, MYP task clarifications, ATL skills, Summative assessment ideas
- Inline **Edit button** (label + prompt template). Templates can use `{{topic}}`, `{{context}}`, `{{curriculum}}`, `{{grade}}`
- **Curriculum** and **Grade** selectors
- **Profiles**: all topics, buttons, logs, and history saved per profile
- **History**: reload any past output into the editor
- **Selection Editing**: highlight text in the output, write an instruction, and the selection is replaced by the model’s response
- **UI divider fix** (clear border between center and right panel)

## Quick Start

1) Install Node.js 18+  
2) Unzip this folder and open a terminal here.  
3) Install deps:
```bash
npm install
```
4) Copy `.env.example` to `.env` and set `OPENAI_API_KEY` (or leave empty to use mock responses):
```bash
cp .env.example .env
```
5) Run dev server:
```bash
npm run dev
```
6) Open http://localhost:3000

## Using the app

- **Profiles** (top bar): create/switch to keep separate sets of topics, buttons, and history.
- **Class settings** (left): choose **Curriculum** and **Grade**; these can be referenced in prompts via `{{curriculum}}` and `{{grade}}`.
- **Topics** (left): add and select a topic; `{{topic}}` will use the selected topic title.
- **Context** (center): paste notes/links; attach text/PDF files (read locally). `{{context}}` pulls all of this into prompts.
- **Buttons** (right): click to generate; **✎ Edit** to change label and template in place, or **＋ Create New Button** to add new ones.
- **Selection editing**: highlight part of the output, type an instruction, and apply to just that selection.
- **History** (right): reload past outputs into the editor.

## Privacy & GDPR (high level)

- API mock mode works without keys. With a key, requests go through `/api/generate` (server route).  
- **Data minimization**: default **Redact PII** toggle replaces emails/phones/IDs and blocks student names unless explicitly allowed.  
- Local-only file reading; you choose what to include in prompts.  
- Per-profile **logs** and **history** support auditability.  
- For production: add authentication, a database, encryption, DPA with provider, data retention & deletion flows, and consent/age-gating for students.

## Customize

- Global buttons are in the UI (create/edit).  
- Types are in `lib/types.ts`.  
- Redaction helper in `lib/redact.ts`.  
- Styling in `styles/globals.css`.

---

**Note:** This is an MVP. For deployment, add auth and a database, then move the profile/state from `localStorage` to your DB.
