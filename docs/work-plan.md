# Work Plan

This is the practical build plan for turning Crammer into an open source
education SaaS with BYOK, subscriptions, and template-based study materials.

## Phase 0: Project Foundation

Goal: make the project easier to understand, run, and contribute to.

- Refresh README and planning docs.
- Choose license.
- Add contribution guide.
- Add issue templates.
- Add roadmap labels.
- Add example transcripts for local demos.
- Add screenshots or a short demo GIF.

Exit criteria:

- New contributors understand what Crammer is, where it is going, and how to
  run it locally.

## Phase 1: Durable Core

Goal: remove the biggest prototype limitation.

- Choose database tool: Prisma or Drizzle.
- Add SQLite local support and Postgres-ready config.
- Create models for files, transcripts, lectures, and podcast scripts.
- Add a repository layer.
- Replace in-memory store behavior incrementally.
- Keep current API response shapes stable.
- Add migrations and seed/demo data.

Exit criteria:

- Uploads, transcripts, lectures, and generated scripts survive a server
  restart.

## Phase 2: Transcript-First Ingestion

Goal: support users who already have transcripts.

- Add transcript text upload.
- Add pasted transcript input.
- Add transcript source metadata.
- Allow lecture grouping from transcript-only sources.
- Update UI copy around recordings and transcripts.

Exit criteria:

- A user can create lectures and generated materials without uploading audio.

## Phase 3: Study Material Templates

Goal: generalize podcast generation into a reusable material pipeline.

- Add `StudyMaterial` type and persistence.
- Add a built-in template registry.
- Add templates for study guide, flashcards, quiz, glossary, cram sheet, and
  podcast script.
- Add `/api/generate-material`.
- Keep `/api/generate-podcast` as a compatibility wrapper or migrate the UI.
- Render generated materials in lecture detail.

Exit criteria:

- Users can generate at least three material types from one lecture.

## Phase 4: Exports

Goal: make Crammer outputs useful outside the app.

- Add Markdown export.
- Add Anki-compatible CSV export for flashcards.
- Add JSON export for structured materials.
- Add DOCX export for printable lecture study documents.
- Add PDF export for study guides and cram sheets.
- Add bundled course export later.

Exit criteria:

- Users can download generated materials in practical study formats.

## Phase 4.5: Crammer MCP

Goal: expose Crammer's learning context to agents and automation clients.

- Add MCP resources for courses, lectures, transcripts, materials, and
  templates.
- Add MCP tools for search, generation, and export.
- Add local self-host auth token support.
- Add cloud workspace-scoped tokens later.
- Apply the same usage and permission checks as the web app.

Exit criteria:

- A local MCP client can search lectures, read a transcript, generate a study
  material, and export it.

## Phase 5: Background Processing

Goal: make long-running work reliable.

- Pick queue/workflow tool.
- Move transcription into jobs.
- Move lecture grouping into jobs.
- Move study material generation into jobs.
- Add job statuses and retry visibility.
- Add cleanup for temporary uploads and provider files.

Exit criteria:

- Long uploads and AI calls do not rely on a single HTTP request staying alive.

## Phase 6: Accounts and Workspaces

Goal: support cloud and multi-user self-hosted deployments.

- Add durable auth.
- Add users.
- Add workspaces.
- Add courses.
- Add workspace membership.
- Add ownership checks to API routes.
- Preserve simple single-secret auth as a self-host option if useful.

Exit criteria:

- Users can own courses and materials securely.

## Phase 7: BYOK UI

Goal: let users and workspaces manage provider keys.

- Add encrypted credential storage.
- Add provider credential settings UI.
- Add key resolution order.
- Add masked key previews.
- Add delete/replace flows.
- Add clear billing responsibility copy for BYOK users.

Exit criteria:

- A user or workspace can use their own provider keys without editing env vars.

## Phase 8: Subscriptions and Usage

Goal: launch a paid cloud product.

- Add Stripe checkout.
- Add billing portal.
- Add subscription plans.
- Add usage events.
- Add monthly limits.
- Add managed-credit plan behavior.
- Add BYOK cloud plan behavior.
- Add admin visibility into usage and failures.

Exit criteria:

- Cloud users can subscribe, hit sensible limits, and manage billing.

## Phase 9: Community Template Ecosystem

Goal: make the open source community useful beyond code contributions.

- Add `templates/` repo structure.
- Add template validation.
- Add template contribution docs.
- Add example templates.
- Add community template import/install flow later.
- Add template gallery in cloud later.

Exit criteria:

- Contributors can add templates through clear, reviewable files.

## Phase 10: Educator and Team Workflows

Goal: expand beyond individual students.

- Add shared course libraries.
- Add share links for generated materials.
- Add educator templates.
- Add bulk upload/generation.
- Add LMS integrations.
- Add classroom or cohort workspaces.

Exit criteria:

- Crammer is useful for tutors, course creators, and small classes.

## Immediate Next Implementation Tasks

1. Decide license.
2. Choose Prisma or Drizzle.
3. Design the initial durable schema.
4. Add transcript-first input.
5. Add `StudyMaterial` and a template registry.
6. Migrate podcast generation into the generic material system.
7. Add the lecture study document template and DOCX export path.
8. Add initial read-only MCP resources after durable persistence exists.

## Verification Standard

For code changes:

- Run `npm run lint` for TypeScript, React, and style edits.
- Run `npm run build` for broad changes, route changes, type changes,
  dependency changes, and release preparation.
- Manually sanity-check upload, transcription, lecture processing, lecture
  detail, generation, exports, and login when affected.
