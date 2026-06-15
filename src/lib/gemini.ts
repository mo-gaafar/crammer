import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { AudioFile, Lecture, PodcastFormat, StudyTemplate, Transcription } from "@/types";
import { withRetry } from "@/lib/retry";
import { pcmToWav, splitForTts, countScriptAudioChunks } from "@/lib/tts-utils";
import { cleanForSpokenFlow } from "@/lib/spoken-text";
export { GEMINI_MODELS, DEFAULT_GEMINI_MODEL } from "@/lib/gemini-models";
import { DEFAULT_GEMINI_MODEL } from "@/lib/gemini-models";

const GEMINI_TIMEOUT_MS = 600_000; // 10 min — large audio files need time
const TEXT_AUDIO_TIMEOUT_MS = 120_000;
const TEXT_AUDIO_TTS_ATTEMPTS = 3;
const GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";

const getClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set in environment variables");
  return new GoogleGenerativeAI(apiKey);
};

const getFileManager = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set in environment variables");
  return new GoogleAIFileManager(apiKey);
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
 * Transcribe an audio file using Gemini's multimodal capabilities.
 */
export async function transcribeWithGemini(
  filePath: string,
  audioFileId: string,
  mimeType: string,
  model: string = DEFAULT_GEMINI_MODEL
): Promise<Transcription> {
  const fileManager = getFileManager();
  const genAI = getClient();

  const uploadResult = await withRetry(() =>
    fileManager.uploadFile(filePath, { mimeType, displayName: audioFileId })
  );

  // Wait for the file to finish processing before generating
  let file = uploadResult.file;
  while (file.state === "PROCESSING") {
    await new Promise((r) => setTimeout(r, 4000));
    file = await fileManager.getFile(file.name);
  }
  if (file.state === "FAILED") {
    throw new Error(`Gemini file processing failed for ${audioFileId}`);
  }

  try {
    const geminiModel = genAI.getGenerativeModel({ model });

    const result = await withRetry(() =>
      geminiModel.generateContent(
        [
          { fileData: { mimeType: file.mimeType, fileUri: file.uri } },
          {
            text: "Transcribe this audio recording accurately. If there are multiple speakers, label them (e.g., 'Speaker 1:', 'Speaker 2:'). Return only the transcription text, no commentary.",
          },
        ],
        { timeout: GEMINI_TIMEOUT_MS }
      )
    );

    const text = cleanForSpokenFlow(result.response.text());
    if (!text) throw new Error("Gemini returned an empty transcription");

    return { audioFileId, text, words: [], confidence: 1.0, duration: 0 };
  } finally {
    await fileManager.deleteFile(uploadResult.file.name).catch(() => {});
  }
}

/**
 * Use Gemini to infer lecture groupings and metadata from transcriptions.
 */
export async function inferLectures(
  transcriptions: TranscriptionInput[],
  model: string = DEFAULT_GEMINI_MODEL
): Promise<LectureGroup[]> {
  const geminiModel = getClient().getGenerativeModel({ model });

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

  const result = await withRetry(() =>
    geminiModel.generateContent(prompt, { timeout: GEMINI_TIMEOUT_MS })
  );
  const raw = result.response
    .text()
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  let parsed: { lectures: LectureGroup[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Failed to parse Gemini response as JSON: ${raw.slice(0, 300)}`);
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
  format: PodcastFormat,
  model: string = DEFAULT_GEMINI_MODEL
): Promise<{ title: string; description: string; script: string }> {
  const geminiModel = getClient().getGenerativeModel({ model });

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

CRITICAL FORMATTING RULES — the script will be fed directly to a text-to-speech engine:
- Use PLAIN TEXT ONLY. No markdown whatsoever.
- No asterisks, underscores, pound signs, backticks, tildes, carets, pipes, angle brackets, bullets, or bullet dashes.
- Avoid standalone pronounceable symbols that interrupt speech, including at signs, ampersands, percent signs, plus signs, and equals signs. Write them as words instead.
- No stage directions, no parenthetical cues, no square brackets or curly brackets.
- No bold, italic, or any other emphasis markers.
- Speaker labels are the ONLY formatting allowed, written as "SPEAKER NAME:" on its own line, e.g. "EXPERT:" or "STUDENT:".
- Sentences should read naturally when spoken aloud.

Include a compelling episode title and a 1-2 sentence episode description at the top (labeled "TITLE:" and "DESCRIPTION:").`;

  const result = await withRetry(() =>
    geminiModel.generateContent(prompt, { timeout: GEMINI_TIMEOUT_MS })
  );
  const text = result.response.text();

  const titleMatch = text.match(/TITLE:\s*(.+)/i);
  const descMatch = text.match(/DESCRIPTION:\s*(.+)/i);

  const podcastTitle = titleMatch?.[1]?.trim() ?? `${lecture.title} - Podcast`;
  const description = descMatch?.[1]?.trim() ?? lecture.summary;

  const script = cleanForSpokenFlow(text
    .replace(/TITLE:\s*.+\n?/i, "")
    .replace(/DESCRIPTION:\s*.+\n?/i, "")
  );

  return { title: podcastTitle, description, script };
}

/**
 * Generate a study material from a reusable template.
 */
export async function generateStudyMaterial(
  lecture: Lecture,
  audioFiles: AudioFile[],
  template: StudyTemplate,
  model: string = DEFAULT_GEMINI_MODEL
): Promise<{ title: string; description: string; contentMarkdown: string }> {
  const geminiModel = getClient().getGenerativeModel({ model });

  const prompt = `You are an academic study-material designer.

LECTURE DETAILS:
Title: ${lecture.title}
Key Topics: ${lecture.keyTopics.join(", ")}
Summary: ${lecture.summary}
Source Files: ${audioFiles.map((f) => f.originalName).join(", ")}

TEMPLATE:
Name: ${template.name}
Type: ${template.type}
Description: ${template.description}

TEMPLATE INSTRUCTIONS:
${template.prompt}

FULL TRANSCRIPT:
${lecture.fullTranscript.slice(0, 80_000)}

Return the material in clean Markdown.
Start with:
TITLE: <specific title>
DESCRIPTION: <one sentence describing the material>

Then include the complete Markdown study material.`;

  const result = await withRetry(() =>
    geminiModel.generateContent(prompt, { timeout: TEXT_AUDIO_TIMEOUT_MS })
  );
  const text = result.response.text();

  const titleMatch = text.match(/TITLE:\s*(.+)/i);
  const descMatch = text.match(/DESCRIPTION:\s*(.+)/i);

  const title = titleMatch?.[1]?.trim() ?? `${lecture.title} - ${template.name}`;
  const description = descMatch?.[1]?.trim() ?? template.description;
  const contentMarkdown = text
    .replace(/TITLE:\s*.+\n?/i, "")
    .replace(/DESCRIPTION:\s*.+\n?/i, "")
    .trim();

  return { title, description, contentMarkdown };
}

export async function generateReadableScriptFromText(
  sourceName: string,
  text: string,
  model: string = DEFAULT_GEMINI_MODEL
): Promise<{ title: string; script: string }> {
  const geminiModel = getClient().getGenerativeModel({ model });

  const prompt = `You are an educational script editor.

SOURCE NAME:
${sourceName}

SOURCE TEXT:
${text.slice(0, 80_000)}

Turn this source into a clear, readable audio script that can be spoken naturally.
- Preserve the important ideas and sequence.
- Remove formatting artifacts, repeated headers, citations clutter, and text that sounds awkward aloud.
- Write as a single-narrator monologue, not a dialogue and not Q&A.
- Cover every meaningful detail from the pasted source. Do not summarize away specifics.
- Keep the source order unless rearranging slightly makes the explanation easier to follow.
- Slow down mentally dense ideas by repeating them in a second simpler wording.
- For concepts that take time to process, restate the key point, then say why it matters.
- Use gentle checkpoint lines like "The part to hold onto is..." before important takeaways.
- Add short transitions where they improve comprehension.
- Keep the tone calm, direct, and low-pressure for a listener who has bad focus or feels stressed.
- Avoid speaker labels such as HOST, GUIDE, Student, Expert, Alex, or Riley.
- Use plain text only. Remove or rewrite asterisks, bullets, markdown symbols, brackets, at signs, ampersands, percent signs, plus signs, equals signs, and other symbols that would sound awkward through text-to-speech.

Return:
TITLE: <short title based on the source>
SCRIPT:
<complete readable script>`;

  const result = await withRetry(() =>
    geminiModel.generateContent(prompt, { timeout: GEMINI_TIMEOUT_MS })
  );
  const raw = result.response.text().trim();
  const titleMatch = raw.match(/TITLE:\s*(.+)/i);
  const script = cleanForSpokenFlow(raw
    .replace(/TITLE:\s*.+\n?/i, "")
    .replace(/^SCRIPT:\s*/i, "")
  );

  return {
    title: titleMatch?.[1]?.trim() || sourceName.replace(/\.[^.]+$/, "") || "Readable Script",
    script,
  };
}

export { countScriptAudioChunks } from "@/lib/tts-utils";

async function synthesizePcmChunk(text: string, chunkNumber: number, totalChunks: number): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set in environment variables");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent`;
  let response: Response;
  try {
    response = await withRetry(
      async () => {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          signal: AbortSignal.timeout(TEXT_AUDIO_TIMEOUT_MS),
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Read this study script aloud in a warm, clear voice. This is part ${chunkNumber} of ${totalChunks}, so continue naturally without a big introduction or ending:\n\n${text}`,
                  },
                ],
              },
            ],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: "Kore" },
                },
              },
            },
            model: GEMINI_TTS_MODEL,
          }),
        });
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`${res.status}: ${errorText.slice(0, 300)}`);
        }
        return res;
      },
      TEXT_AUDIO_TTS_ATTEMPTS,
      2000
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.startsWith("4") || message.startsWith("5")) {
      throw new Error(`Gemini TTS failed: ${message}`);
    }
    throw new Error(`Could not reach Gemini TTS. Check internet access, GEMINI_API_KEY, and TTS model access. Details: ${message}`);
  }

  const data = await response.json();
  const inlineData = data?.candidates?.[0]?.content?.parts?.find(
    (part: { inlineData?: { data?: string } }) => part.inlineData?.data
  )?.inlineData;
  if (!inlineData?.data) throw new Error("Gemini TTS returned no audio data");

  return Buffer.from(inlineData.data, "base64");
}

export async function synthesizeScriptAudio(
  script: string,
  onProgress?: (progress: { done: number; total: number }) => void
): Promise<Buffer> {
  const chunks = splitForTts(cleanForSpokenFlow(script));
  if (chunks.length === 0) throw new Error("Script is empty");

  onProgress?.({ done: 0, total: chunks.length });

  const pcmChunks: Buffer[] = [];
  for (let i = 0; i < chunks.length; i++) {
    pcmChunks.push(await synthesizePcmChunk(chunks[i], i + 1, chunks.length));
    onProgress?.({ done: i + 1, total: chunks.length });
  }

  return pcmToWav(Buffer.concat(pcmChunks));
}
