import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { store } from "@/lib/store";
import { getOptionalClient } from "@/lib/supabase/server";
import { inferLectures } from "@/lib/gemini";
import { Lecture } from "@/types";

/**
 * POST /api/process
 * Body: { geminiModel?: string }
 * Groups transcribed audio files into lectures using Gemini.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getOptionalClient();
    const body = await request.json().catch(() => ({}));
    const geminiModel: string | undefined = body.geminiModel;

    store.updateStatus({ phase: "processing" });

    const audioFiles = await store.getAllAudioFiles(supabase);
    const transcribedFiles = audioFiles.filter((f) => f.status === "transcribed");

    if (transcribedFiles.length === 0) {
      return NextResponse.json(
        { error: "No transcribed files to process" },
        { status: 400 }
      );
    }

    // Sort chronologically by recordedAt
    const sorted = [...transcribedFiles].sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );

    const transcriptionsById = new Map(
      (await store.getAllTranscriptions(supabase)).map((t) => [t.audioFileId, t])
    );

    // Build input for Gemini — use simple indices instead of UUIDs so Gemini
    // can faithfully reproduce them in the audioFileIds output field.
    const inputs = sorted.map((f, i) => {
      const transcription = transcriptionsById.get(f.id);
      const fullText = transcription?.text ?? "(no transcript)";
      return {
        id: `file_${i}`,
        originalName: f.originalName,
        recordedAt: f.recordedAt,
        // Truncate per-file transcript for the inference prompt to avoid
        // hitting token limits; full text is stored separately in the store.
        transcript: fullText.length > 40_000 ? fullText.slice(0, 40_000) + "\n…[truncated for grouping]" : fullText,
      };
    });

    // Map simple indices back to real file IDs after Gemini returns
    const indexToId: Record<string, string> = {};
    sorted.forEach((f, i) => { indexToId[`file_${i}`] = f.id; });

    // Call Gemini to infer lecture groups — only clear existing data after success
    const lectureGroups = await inferLectures(inputs, geminiModel);

    if (!lectureGroups || lectureGroups.length === 0) {
      throw new Error("Gemini returned no lecture groups");
    }

    store.clearLectures();
    const savedLectures: Lecture[] = [];

    for (const group of lectureGroups) {
      // Build full transcript for the lecture (in chronological order)
      // Resolve Gemini's simple indices back to real file IDs
      const realIds = group.audioFileIds.map((id) => indexToId[id] ?? id);
      const groupFiles = realIds
        .map((id) => sorted.find((f) => f.id === id))
        .filter(Boolean);

      const fullTranscript = groupFiles
        .map((f) => {
          const t = transcriptionsById.get(f!.id);
          const header = `[${f!.originalName} — ${new Date(f!.recordedAt).toLocaleDateString()}]`;
          return `${header}\n${t?.text ?? ""}`;
        })
        .join("\n\n---\n\n");

      // Use the earliest recording date of files in this lecture
      const dates = groupFiles
        .map((f) => new Date(f!.recordedAt).getTime())
        .filter((t) => !isNaN(t));
      const earliestDate = dates.length > 0 ? new Date(Math.min(...dates)) : new Date();

      const lecture: Lecture = {
        id: uuidv4(),
        lectureNumber: group.lectureNumber,
        title: group.title,
        summary: group.summary,
        keyTopics: group.keyTopics,
        audioFileIds: realIds,
        fullTranscript,
        createdAt: earliestDate.toISOString(),
      };

      store.addLecture(lecture);
      savedLectures.push(lecture);
    }

    store.updateStatus({
      lecturesGenerated: savedLectures.length,
      phase: "complete",
    });

    return NextResponse.json({
      lectures: savedLectures.length,
      data: savedLectures,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    store.updateStatus({ phase: "error", errorMessage: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
