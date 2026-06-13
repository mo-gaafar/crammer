# Business Model

Crammer should use an open source core plus a hosted cloud product. The open
source project earns trust and community adoption; the cloud product sells
convenience, scale, collaboration, and managed AI.

## Monetization Thesis

Do not charge for the existence of AI-generated study materials alone. That
market will be crowded.

Charge for:

- hosted convenience
- managed transcription and generation credits
- larger files and higher monthly usage
- batch processing
- course libraries
- collaboration
- exports and integrations
- priority processing
- educator and team workflows

## Recommended Product Ladder

### Open Source Self-Hosted

Free.

- BYOK through environment variables.
- Core upload, transcription, lecture grouping, template generation, and export.
- Local or self-managed persistence once implemented.
- Community templates.

### Crammer Cloud Free

Free hosted entry point.

- Small monthly upload/generation limits.
- Good for trying the product.
- Limited storage and file size.
- Optional BYOK when user-key storage exists.

### Crammer Cloud BYOK

Low-cost hosted convenience plan.

Suggested price: `$5/month`.

- Hosted app and storage.
- User brings provider keys.
- Lower AI margin risk.
- Good for technical users who do not want to deploy.

### Student Plus

Suggested price: `$9-12/month`.

- Managed AI credits.
- More uploads and generations.
- Study guides, flashcards, quizzes, podcasts, and exports.
- Saved course library.

### Pro

Suggested price: `$19-25/month`.

- Higher limits.
- Batch processing.
- Custom templates.
- Longer lectures.
- Priority processing.
- Advanced exports and integrations.

### Educator / Classroom

Suggested price: `$39+/month`, then per-seat or per-course pricing.

- Shared workspaces.
- Reusable class templates.
- Bulk uploads.
- Shareable study packs.
- Student-facing material links.

### Institution

Custom pricing.

- SSO.
- Admin controls.
- Data retention controls.
- Dedicated support.
- LMS integrations.

## Licensing Recommendation

Recommended default: **AGPLv3** for the open source core.

Rationale:

- It is real open source.
- It protects against hosted competitors taking improvements private.
- It still allows self-hosting, learning, modification, and community use.

Alternative: **Apache 2.0** if maximum adoption is more important than hosted
competition protection.

Avoid source-available licenses if the goal is a large open source community.

## What Should Stay Free

- Self-hosted core workflows.
- BYOK.
- Basic built-in templates.
- Basic exports.
- Local development and experimentation.
- Community template contribution.

## What Can Be Paid

- Hosted storage.
- Managed provider credits.
- Larger monthly usage.
- Batch jobs.
- Collaboration.
- Workspace administration.
- Premium templates.
- Private template libraries.
- Integrations.
- Priority processing and support.

## Public Messaging

Use language like:

```text
Self-host Crammer with your own AI keys, or use Crammer Cloud when you want the
setup, storage, transcription, and AI credits handled for you.
```

Avoid making paid users feel judged. The paid product is about focus and
convenience.
