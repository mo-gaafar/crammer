import { createClient } from "@deepgram/sdk";
import fs from "fs";
import { Transcription } from "@/types";

export async function transcribeAudioFile(
  filePath: string,
  audioFileId: string,
  mimeType: string
): Promise<Transcription> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPGRAM_API_KEY is not set in environment variables");
  }

  const deepgram = createClient(apiKey);
  const audioBuffer = fs.readFileSync(filePath);

  const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
    audioBuffer,
    {
      model: "nova-2",
      smart_format: true,
      punctuate: true,
      paragraphs: true,
      diarize: true,
      detect_language: true,
      mimetype: mimeType,
    }
  );

  if (error) {
    throw new Error(`Deepgram transcription error: ${error.message}`);
  }

  const channel = result?.results?.channels?.[0];
  const alternative = channel?.alternatives?.[0];

  if (!alternative) {
    throw new Error("No transcription result returned from Deepgram");
  }

  const text = alternative.transcript ?? "";
  const confidence = alternative.confidence ?? 0;

  const words = (alternative.words ?? []).map((w) => ({
    word: w.word ?? "",
    start: w.start ?? 0,
    end: w.end ?? 0,
    confidence: w.confidence ?? 0,
    speaker: w.speaker,
  }));

  // Extract paragraphs if available
  const paragraphsData = alternative.paragraphs?.paragraphs ?? [];
  const paragraphs = paragraphsData.map((p) =>
    p.sentences?.map((s) => s.text).join(" ") ?? ""
  );

  const duration = result?.metadata?.duration ?? 0;

  return {
    audioFileId,
    text,
    words,
    confidence,
    duration,
    paragraphs: paragraphs.length > 0 ? paragraphs : undefined,
  };
}
