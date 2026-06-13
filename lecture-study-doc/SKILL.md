---
name: lecture-study-doc
description: >
  Converts lecture study question output into a structured Word document (.docx) with two parts:
  Part 1 (questions with writing lines) and Part 2 (model answers revealed separately).
  Use this skill whenever a user wants to export, save, or download their study questions as a Word doc —
  including phrases like "put this in a Word doc", "save these questions as a document", "make a .docx
  from this", "export my study questions", "create a study guide document", "I want to print this",
  "share these with my class", or "give me a file I can keep". Also trigger automatically after the
  lecture-study-questions skill completes if the user asks for a document. Always use this skill —
  do not attempt to build the .docx manually without it.
---

# Lecture Study Doc Skill

Your only job is to write a markdown file in the correct format, then run the bundled script.
The script handles all Word document formatting — do not write any docx code yourself.

---

## Step 1 — Write the markdown file

Write `/tmp/study.md` using this exact format:

```markdown
---
student: Jane Smith
course: Cell Biology 201
major: Pre-Med
lecture: Week 4 — Membrane Transport
date: 2026-06-07
---

## Concept Map

### Cluster Name
- Term [core]
- Term [supporting] (depends on: Other Term)
- Term [mentioned]

### Another Cluster
- Term [core]

---

## Cluster: Cluster Name

[q tier=R]
Question text here.
[/q]

[a]
Model answer here.
[/a]

[q tier=U]
Question text here.
[/q]

[a]
Model answer here.
[/a]

[q tier=A]
Question text here.
[hint] What a strong answer must address. [/hint]
[/q]

[a]
Model answer here.
[/a]

---

## Cluster: Another Cluster

[q tier=R]
...
[/q]

[a]
...
[/a]

---

## Synthesis Questions

[q tier=A]
Question connecting multiple clusters.
[hint] Hint text. [/hint]
[/q]

[a]
Model answer here.
[/a]
```

### Tag reference

| Tag | Required | Notes |
|---|---|---|
| YAML front matter | Yes | `student` is optional; all others required |
| `## Concept Map` | No | Include if study questions were preceded by a concept map |
| `### Cluster Name` (under Concept Map) | No | One per concept cluster |
| `- Term [core\|supporting\|mentioned]` | No | Level label in square brackets; optionally append `(depends on: X, Y)` |
| `## Cluster: Name` | Yes | One per question cluster; name must match what was used in the concept map |
| `[q tier=R\|U\|A]` … `[/q]` | Yes | Wraps the question text |
| `[hint]` … `[/hint]` | No | Inside `[q]`…`[/q]`, before the closing tag; for [A] questions |
| `[a]` … `[/a]` | Yes | Wraps the model answer; immediately follows its `[q]` block |
| `## Synthesis Questions` | No | Include if synthesis questions were generated; same `[q]`/`[a]` format |

### Rules
- Reproduce all questions and answers fully — do not truncate or summarise
- `tier=` value must be exactly `R`, `U`, or `A` (uppercase)
- Concept map level must be exactly `core`, `supporting`, or `mentioned` (lowercase)
- Write the markdown using `cat > /tmp/study.md << 'MDEOF' ... MDEOF` so special characters are preserved
- If the front matter `date` is unknown, use today's date in `YYYY-MM-DD` format

---

## Step 2 — Install dependency

```bash
npm list -g docx 2>/dev/null | grep -q docx || npm install -g docx
```

---

## Step 3 — Run the script

```bash
SKILL_DIR="$(find /mnt/skills -type d -name 'lecture-study-doc' 2>/dev/null | head -1)"
cp "$SKILL_DIR/scripts/generate.js" /tmp/generate-study-doc.js
node /tmp/generate-study-doc.js --input /tmp/study.md --output /tmp/study-questions.docx
```

Expected output:
```
✓ Written: /tmp/study-questions.docx
```

---

## Step 4 — Validate

```bash
python scripts/office/validate.py /tmp/study-questions.docx
```

If validation fails, report the error — do not attempt to fix XML manually unless the error message points to a specific field.

---

## Step 5 — Deliver

```bash
cp /tmp/study-questions.docx /mnt/user-data/outputs/study-questions.docx
```

Call `present_files` with `/mnt/user-data/outputs/study-questions.docx`.

---

## What the script produces

| Part | Content |
|---|---|
| Cover page | Course, lecture, student name, date; "Part 1: Questions — Part 2: Model Answers" note |
| Table of Contents | Auto-linked to all headings |
| Concept Map | Clusters as H2; Core (bold) / Supporting / Mentioned (italic) items; dependency sub-bullets |
| **Part 1 — Questions** | All questions with tier badges `[R]`/`[U]`/`[A]` in colour; hints in italic; three blank writing lines per question |
| **Part 2 — Model Answers** | Question re-stated, followed by the model answer in a coloured left-border block matching the tier colour |
| Header | Course — Lecture (left), student name (right) |
| Footer | "Part 1 — Questions" or "Part 2 — Model Answers" (left), page number (right) |
