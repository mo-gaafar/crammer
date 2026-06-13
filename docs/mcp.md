# Crammer MCP

Crammer can eventually ship its own MCP server so AI agents, IDEs, note-taking
tools, and automation clients can work with a user's courses and study
materials.

## Why MCP Fits

Crammer stores learning context:

- courses
- source files
- transcripts
- lecture groups
- study templates
- generated materials
- exports

An MCP server lets users bring that context into other tools without copying
large transcripts around manually.

## Product Use Cases

- Ask an agent to find the lecture where a concept was explained.
- Generate a study guide from a selected lecture.
- Export flashcards for a course.
- Create a printable study question bank from several lectures.
- Compare two lectures for overlapping concepts.
- Pull course context into an IDE, writing app, tutoring assistant, or local
  agent.
- Let self-hosted users automate Crammer without relying on Crammer Cloud.

## MCP Surfaces

### Resources

Expose read-only content as resources:

```text
crammer://courses
crammer://courses/{courseId}
crammer://lectures/{lectureId}
crammer://lectures/{lectureId}/transcript
crammer://lectures/{lectureId}/materials
crammer://materials/{materialId}
crammer://templates
crammer://templates/{templateId}
```

### Tools

Expose deliberate actions as tools:

```text
search_lectures(query, courseId?)
get_transcript(lectureId)
generate_study_material(lectureId, templateId, options?)
generate_course_pack(courseId, templateIds, options?)
export_material(materialId, format)
list_templates(category?)
create_template_draft(name, description, schema)
```

For SaaS accounts, tools must enforce auth, workspace permissions, plan limits,
and usage metering.

### Prompts

Offer reusable prompts for common workflows:

```text
crammer/study-guide-from-lecture
crammer/quiz-me-on-lecture
crammer/make-flashcards
crammer/create-printable-study-doc
crammer/summarize-course-progress
```

## Auth Modes

Self-hosted:

- local token
- environment-configured admin token
- optional no-auth local mode for private machines

Crammer Cloud:

- user API tokens
- workspace-scoped tokens
- OAuth later if needed

## Privacy Rules

- Never expose provider keys through MCP.
- Never return hidden billing or credential data.
- Default to read-only resources.
- Require explicit tool calls for generation and export actions.
- Respect workspace membership and material visibility.
- Apply the same usage limits as the web app.

## Implementation Plan

1. Define a stable repository layer for courses, lectures, transcripts, and
   materials.
2. Add read-only MCP resources for lectures and transcripts.
3. Add `list_templates` and `generate_study_material`.
4. Add export tools for Markdown, JSON, DOCX, and PDF.
5. Add auth tokens and workspace scoping.
6. Add usage events for MCP tool calls.
7. Document example clients and local self-host setup.

## SaaS Angle

MCP can become a strong paid feature without harming open source:

- self-hosted users can run MCP locally with BYOK
- Cloud BYOK users get hosted MCP access with their provider keys
- managed Cloud users get MCP plus managed credits and storage
- teams get workspace-scoped MCP access for class/course automation
