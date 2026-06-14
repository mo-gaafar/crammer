import { StudyTemplate } from "@/types";

export const STUDY_TEMPLATES: StudyTemplate[] = [
  {
    id: "study-guide-core",
    name: "Study Guide",
    description: "Turn the lecture into organized notes, key ideas, review questions, and takeaways.",
    category: "review",
    type: "study_guide",
    source: "built-in",
    exports: ["markdown"],
    prompt: `Create a polished study guide from the lecture.

Include:
- A concise overview
- Key concepts grouped under clear headings
- Important definitions
- Worked examples or applications when supported by the transcript
- 8-12 review questions with answers
- A final exam-focus checklist

Stay grounded in the transcript. Do not invent course facts that are not present.`,
  },
  {
    id: "flashcards-basic",
    name: "Flashcards",
    description: "Generate active-recall question and answer cards for spaced repetition.",
    category: "review",
    type: "flashcards",
    source: "community",
    exports: ["markdown", "anki-csv"],
    prompt: `Create flashcards from the lecture.

Return 20-35 cards as a Markdown table with these columns:
- Front
- Back
- Topic

Make each front side a single focused recall prompt. Keep answers short but complete.`,
  },
  {
    id: "quiz-multiple-choice",
    name: "Multiple Choice Quiz",
    description: "Build a self-test with answer key and short explanations.",
    category: "assessment",
    type: "quiz",
    source: "community",
    exports: ["markdown"],
    prompt: `Create a multiple choice quiz from the lecture.

Include:
- 12-18 questions
- Four options per question labeled A-D
- The correct answer
- A one-sentence explanation grounded in the transcript

Mix recall, understanding, and application questions.`,
  },
  {
    id: "glossary-core",
    name: "Glossary",
    description: "Extract important terms, definitions, and why each term matters.",
    category: "reference",
    type: "glossary",
    source: "built-in",
    exports: ["markdown", "json"],
    prompt: `Create a glossary from the lecture.

Return terms in alphabetical order. For each term include:
- Definition
- Why it matters in this lecture
- Related terms when present

Only include terms actually supported by the transcript.`,
  },
  {
    id: "exam-cram-sheet",
    name: "Exam Cram Sheet",
    description: "Compress the lecture into a fast pre-exam review page.",
    category: "notes",
    type: "notes",
    source: "community",
    exports: ["markdown"],
    prompt: `Create an exam cram sheet from the lecture.

Use dense, scannable Markdown:
- Must-know ideas
- Common confusions
- Fast definitions
- Likely exam prompts
- Last-minute memory hooks

Prioritize high-yield material over completeness.`,
  },
];

export function getStudyTemplate(templateId: string): StudyTemplate | undefined {
  return STUDY_TEMPLATES.find((template) => template.id === templateId);
}
