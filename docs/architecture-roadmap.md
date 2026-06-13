# Architecture Roadmap

This document describes the technical direction from the current prototype to a
self-hostable open source app and paid SaaS.

## Current Architecture

The app currently uses:

- Next.js App Router.
- API routes for upload, Drive import, transcription, processing, and podcast
  generation.
- A global in-memory singleton in `src/lib/store.ts`.
- Uploaded files under `/tmp/crammer-uploads`.
- Environment-based provider keys.
- Optional secret-key auth through middleware.
- No MCP server yet.

This is good for a prototype, but not enough for durable self-hosting or SaaS.

## Target Architecture

```text
Next.js app
  -> API routes / server actions
  -> auth and workspace context
  -> repository layer
  -> database
  -> object storage
  -> background job queue
  -> provider adapters
  -> optional MCP server
```

## Persistence

Add durable storage before building serious SaaS features.

Recommended path:

- SQLite for simple self-hosted/local mode.
- Postgres for cloud and production.
- A repository layer that keeps API routes from depending directly on a
  specific database client.

Possible tools:

- Prisma for faster schema iteration and migrations.
- Drizzle for lighter SQL-oriented control.

## Storage

Move from only `/tmp/crammer-uploads` to a storage abstraction.

Targets:

- local filesystem for self-hosting
- S3-compatible object storage for cloud

Files to model:

- original uploads
- imported Drive files
- transcripts
- exported materials
- generated audio later if added

## Background Jobs

Long-running work should leave request/response lifetimes.

Use jobs for:

- transcription
- lecture grouping
- template generation
- export rendering
- cleanup

Potential tools:

- Inngest for quick Next.js-friendly background workflows.
- BullMQ plus Redis for a more traditional queue.
- A separate worker process for heavy audio or AI jobs.

## Accounts and Workspaces

SaaS requires durable identity and billing ownership.

Core entities:

- User
- Workspace
- WorkspaceMember
- Course
- SourceFile
- Transcript
- Lecture
- StudyMaterial
- ProviderCredential
- Subscription
- UsageEvent

## Provider Adapters

Current helpers should evolve into provider adapters:

- Deepgram STT
- Gemini STT
- Gemini generation
- future OpenAI generation
- future Anthropic generation

Provider helpers should accept resolved keys instead of owning all key lookup.

## Usage Metering

Cloud plans need usage accounting.

Track:

- uploaded file count
- uploaded storage bytes
- transcription minutes
- generation count
- provider token usage when available
- export count if needed

Use usage events instead of only incrementing counters so billing behavior can
be audited.

## MCP Server

Crammer can expose courses, lectures, transcripts, templates, generated
materials, and exports through an MCP server.

Initial MCP resources:

- courses
- lectures
- lecture transcripts
- generated materials
- templates

Initial MCP tools:

- search lectures
- generate study material
- export material
- generate course pack

The MCP server should use the same repository layer, auth checks, provider key
resolution, and usage metering as the web app. It should never expose provider
keys or hidden billing data.

## Migration Sequence

1. Introduce database schema and repository layer.
2. Move store behavior behind repositories while preserving API response shapes.
3. Add durable file metadata and transcript persistence.
4. Add generic `StudyMaterial`.
5. Migrate podcast scripts into `StudyMaterial`.
6. Add template registry.
7. Add export endpoints.
8. Add background jobs.
9. Add accounts/workspaces.
10. Add provider credential storage.
11. Add Stripe subscriptions and usage limits.
12. Add MCP server resources and tools.

## Compatibility Rule

Do not silently change API response shapes used by client pages. Introduce new
fields additively or update client and server together in the same change.
