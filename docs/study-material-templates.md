# Study Material Templates

Templates should become the heart of Crammer. A template defines how lecture
content is transformed into a specific study material.

## Why Templates Matter

Templates create repeatable outputs. They also give the open source community a
way to contribute without needing to change core infrastructure.

Examples:

- Cornell notes
- concise summary
- detailed study guide
- printable lecture study document
- flashcards
- multiple choice quiz
- short answer quiz
- glossary
- formula sheet
- timeline
- essay prompts
- case brief
- review podcast
- exam cram sheet
- "explain it like I missed class"

## Template Shape

A future template should define:

- id
- name
- description
- category
- input requirements
- prompt instructions
- output schema
- supported exports
- default model/provider preferences
- whether it is built-in, community, user-created, or premium

Example:

```json
{
  "id": "flashcards-basic",
  "name": "Flashcards",
  "category": "review",
  "description": "Generate question/answer cards from a lecture transcript.",
  "outputType": "flashcards",
  "exports": ["anki-csv", "markdown", "json"]
}
```

## Output Types

Start with a small number of structured output types:

- `notes`
- `flashcards`
- `quiz`
- `glossary`
- `podcast_script`
- `study_guide`
- `lecture_study_doc`

Do not create a new database model for every template. Store a generic
`StudyMaterial` with a `type`, `templateId`, and structured `content`.

## Suggested StudyMaterial Model

```text
StudyMaterial
  id
  lectureId
  courseId
  templateId
  type
  title
  contentJson
  contentMarkdown
  provider
  model
  generationStatus
  createdAt
  updatedAt
```

## Community Template Path

A later repo structure could look like:

```text
templates/
  flashcards-basic/
    template.json
    prompt.md
    examples/
  cornell-notes/
    template.json
    prompt.md
  med-school-review/
    template.json
    prompt.md
```

This lets contributors add useful templates without touching app internals.

## First Templates To Build

1. Study guide.
2. Flashcards.
3. Multiple choice quiz.
4. Glossary.
5. Exam cram sheet.
6. Podcast script, migrated from the current dedicated podcast flow.
7. Printable lecture study document.

## Lecture Study Document Template

The `lecture-study-doc.skill` bundle defines the kind of document Crammer
should support as a premium-quality export target. It is not just a summary; it
is a structured study packet.

The generated material should include:

- metadata: student, course, major, lecture, and date
- optional concept map grouped into clusters
- concept labels marked as `core`, `supporting`, or `mentioned`
- clustered questions
- question tiers: `R` for recall, `U` for understanding, and `A` for
  application
- optional hints for application questions
- model answers for every question
- synthesis questions that connect multiple clusters

The exported document should separate active recall from answers:

- cover page
- table of contents
- concept map
- Part 1: questions with writing lines
- Part 2: model answers

This template is especially useful for students, tutors, educators, and class
sharing because it creates a printable artifact that works away from the app.

Recommended internal output shape:

```json
{
  "type": "lecture_study_doc",
  "metadata": {
    "course": "Cell Biology 201",
    "lecture": "Week 4 - Membrane Transport",
    "date": "2026-06-07"
  },
  "conceptMap": [
    {
      "cluster": "Membrane Transport",
      "items": [
        {
          "label": "Osmosis",
          "level": "core",
          "dependsOn": []
        }
      ]
    }
  ],
  "clusters": [
    {
      "name": "Membrane Transport",
      "questions": [
        {
          "tier": "R",
          "question": "Define osmosis as introduced in this lecture.",
          "hint": null,
          "answer": "..."
        }
      ]
    }
  ],
  "synthesisQuestions": []
}
```

Export targets:

- Markdown source for transparent editing.
- DOCX for printable class handouts.
- PDF once document rendering is stable.

## Generation Pipeline

```text
Transcript or lecture
  -> choose template
  -> build prompt with bounded transcript context
  -> call provider with retry
  -> parse strict JSON
  -> save StudyMaterial
  -> render material
  -> export material
```

## Prompting Rules

- Ask for strict JSON when structured output is needed.
- Validate and repair parse failures with useful errors.
- Keep transcript context bounded.
- Preserve citations or transcript references where possible.
- Include the lecture title, date, and source filenames for context.
- Avoid making unsupported claims beyond the transcript unless the template
  explicitly asks for outside explanation.
