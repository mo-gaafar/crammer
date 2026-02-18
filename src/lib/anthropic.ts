import Anthropic from "@anthropic-ai/sdk";
import { AudioFile, Lecture, PodcastFormat } from "@/types";

const getClient = () => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set in environment variables");
  return new Anthropic({ apiKey });
};

interface TranscriptionInput {
  id: string;
  originalName: string;
  recordedAt: string;
  transcript: string;
}

interface LectureGroup {
  lectureNumber: number;
  title: string;
  summary: string;
  keyTopics: string[];
  audioFileIds: string[];
}

/**
 * Use Claude to infer lecture groupings and metadata from transcriptions.
 * Returns an ordered array of lecture groups.
 */
export async function inferLectures(
  transcriptions: TranscriptionInput[]
): Promise<LectureGroup[]> {
  const client = getClient();

  const prompt = `You are an academic assistant analyzing voice notes from lectures.

I have ${transcriptions.length} audio voice note(s) with their transcriptions, listed in chronological order:

${transcriptions
  .map(
    (t, i) => `
--- Voice Note ${i + 1} ---
ID: ${t.id}
File: ${t.originalName}
Recorded: ${t.recordedAt}
Transcript:
${t.transcript}
`
  )
  .join("\n")}

Your task:
1. Group these voice notes into logical LECTURES based on topic continuity and recording dates
2. Notes recorded on the same day or covering the same subject belong to the same lecture
3. Give each lecture a concise, descriptive academic title
4. Identify 3-6 key topics/concepts covered in each lecture
5. Write a 2-3 sentence summary of each lecture

Return ONLY valid JSON matching this exact structure (no markdown, no code fences):
{
  "lectures": [
    {
      "lectureNumber": 1,
      "title": "string",
      "summary": "string",
      "keyTopics": ["topic1", "topic2", "topic3"],
      "audioFileIds": ["id1", "id2"]
    }
  ]
}`;

  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  // Strip any accidental markdown fences
  const raw = content.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  let parsed: { lectures: LectureGroup[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Failed to parse Claude response as JSON: ${raw.slice(0, 300)}`);
  }

  return parsed.lectures;
}

/**
 * Generate a podcast script for a lecture in the specified format.
 */
export async function generatePodcastScript(
  lecture: Lecture,
  audioFiles: AudioFile[],
  transcript: string,
  format: PodcastFormat
): Promise<{ title: string; description: string; script: string }> {
  const client = getClient();

  const formatInstructions: Record<PodcastFormat, string> = {
    qa: `Format: Q&A Style
Write a podcast episode as a question-and-answer session between a curious student (STUDENT) and an expert (EXPERT).
- The student asks probing, genuine questions
- The expert gives clear, engaging answers with examples and analogies
- Cover all key topics from the lecture
- Make it conversational and educational
- Include 8-15 Q&A exchanges
- Start with an intro and end with a brief takeaway section`,

    narrative: `Format: Solo Narrative
Write a podcast episode as an engaging solo monologue by a knowledgeable host (HOST).
- Walk through the concepts in a logical, story-like flow
- Use analogies, examples, and real-world connections
- Break it into clear sections with natural transitions
- Make complex ideas accessible to someone new to the subject
- Include a hook opening and key takeaways at the end`,

    discussion: `Format: Two-Host Discussion
Write a podcast episode as a conversation between two co-hosts: ALEX and RILEY.
- Alex tends to ask the "bigger picture" questions
- Riley focuses on practical details and examples
- They build on each other's points, occasionally disagree respectfully
- Natural back-and-forth, no one dominates
- Cover all key topics through their conversation
- Include an intro, main discussion, and wrap-up`,
  };

  const prompt = `You are a professional podcast script writer specializing in educational content.

LECTURE DETAILS:
Title: ${lecture.title}
Key Topics: ${lecture.keyTopics.join(", ")}
Summary: ${lecture.summary}
Source Files: ${audioFiles.map((f) => f.originalName).join(", ")}

FULL TRANSCRIPT:
${transcript}

${formatInstructions[format]}

Write a complete, ready-to-record podcast script based on this lecture content.
The script should be engaging, educational, and approximately 10-20 minutes of audio when read aloud.

Return the script with clear speaker labels and stage directions where helpful.
Include a compelling episode title and a 1-2 sentence episode description at the top (labeled "TITLE:" and "DESCRIPTION:").`;

  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  const text = content.text;

  // Extract title and description from the response
  const titleMatch = text.match(/TITLE:\s*(.+)/i);
  const descMatch = text.match(/DESCRIPTION:\s*(.+)/i);

  const podcastTitle = titleMatch?.[1]?.trim() ?? `${lecture.title} - Podcast`;
  const description = descMatch?.[1]?.trim() ?? lecture.summary;

  // Remove the TITLE/DESCRIPTION lines from the script body
  const script = text
    .replace(/TITLE:\s*.+\n?/i, "")
    .replace(/DESCRIPTION:\s*.+\n?/i, "")
    .trim();

  return { title: podcastTitle, description, script };
}
