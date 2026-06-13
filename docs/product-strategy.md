# Product Strategy

Crammer should be an open source study-material engine with a hosted SaaS for
people who want the easiest path from raw lecture content to useful study
assets.

## Positioning

Turn lectures, transcripts, and recordings into structured study materials.

Crammer should avoid being positioned as only an "AI notes app." The stronger
angle is repeatable transformation:

- lecture recordings to transcripts
- transcripts to cleaned notes
- lectures to study guides
- course material to flashcards and quizzes
- dense material to review podcasts
- course archives to searchable knowledge bases

## Audiences

### Students

Students want fast study assets from messy lecture material. They care about
speed, clarity, exports, affordability, and mobile-friendly review formats.

### Self-Hosters

Self-hosters want control, privacy, provider choice, and BYOK. They should be
able to run the core product without a paid cloud account.

### Educators and Tutors

Educators want repeatable materials for classes: lesson summaries, quizzes,
discussion prompts, review packets, and shareable course libraries.

### Course Creators

Course creators want to transform long-form educational content into supporting
assets that make their courses more valuable.

## Product Principles

- Keep the open source core real, useful, and self-hostable.
- Monetize convenience, scale, collaboration, and managed AI usage.
- Treat templates as the primary product surface.
- Keep provider calls server-side.
- Keep BYOK first-class.
- Make exports excellent; study materials should travel well.
- Build for courses and collections, not only single lectures.

## Product Pillars

### Ingest

Users should be able to bring content from:

- audio and video uploads
- transcript text files
- pasted transcript text
- Google Drive
- future integrations such as Notion, Canvas, Moodle, YouTube, and cloud
  storage providers

### Understand

Crammer should clean, segment, label, group, and search lecture content.

### Transform

The core workflow should become:

```text
Lecture or transcript
  -> selected template
  -> AI generation
  -> structured study material
  -> export, share, revise, or regenerate
```

### Review

Generated outputs should support actual studying:

- spaced repetition exports
- quizzes with answers and explanations
- printable study guides
- mobile review
- audio-friendly scripts
- saved revision history

## Success Metrics

- Time from upload to first useful study material.
- Percentage of users who generate more than one material type per lecture.
- Export usage.
- Repeat weekly usage during school terms.
- Template contributions from the community.
- Self-host installs and cloud conversions.
- Paid users who remain active across multiple courses.
