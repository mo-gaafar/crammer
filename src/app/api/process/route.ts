import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { store } from "@/lib/store";
import { inferLectures } from "@/lib/gemini";
import { parseSequenceFromFilename } from "@/lib/metadata";
import { Lecture } from "@/types";

/**
 * POST /api/process
 * Groups transcribed audio files into lectures using Gemini.
 */
export async function POST() {
  try {
    store.updateStatus({ phase: "processing" });

    const audioFiles = store.getAllAudioFiles();
    const transcribedFiles = audioFiles.filter((f) => f.status === "transcribed");

    if (transcribedFiles.length === 0) {
      return NextResponse.json(
        { error: "No transcribed files to process" },
        { status: 400 }
      );
    }

    // Sort chronologically; if timestamps are within 5 minutes of each other,
    // use filename sequence number (part1/part2, 01_, _02, etc.) as tiebreaker.
    const CLOSE_THRESHOLD_MS = 5 * 60 * 1000;
    const sorted = [...transcribedFiles].sort((a, b) => {
      const timeA = new Date(a.recordedAt).getTime();
      const timeB = new Date(b.recordedAt).getTime();
      const timeDiff = timeA - timeB;
      if (Math.abs(timeDiff) < CLOSE_THRESHOLD_MS) {
        const seqA = parseSequenceFromFilename(a.originalName);
        const seqB = parseSequenceFromFilename(b.originalName);
        if (seqA !== null && seqB !== null) return seqA - seqB;
      }
      return timeDiff;
    });

    // Build input for Gemini
    const inputs = sorted.map((f) => {
      const transcription = store.getTranscription(f.id);
      return {
        id: f.id,
        originalName: f.originalName,
        recordedAt: f.recordedAt,
        transcript: transcription?.text ?? "(no transcript)",
      };
    });

    // Call Gemini to infer lecture groups
    const lectureGroups = await inferLectures(inputs);

    // Clear existing lectures and rebuild
    store.clearLectures();

    const savedLectures: Lecture[] = [];

    for (const group of lectureGroups) {
      // Build full transcript for the lecture (in chronological order)
      const groupFiles = group.audioFileIds
        .map((id) => sorted.find((f) => f.id === id))
        .filter(Boolean);

      const fullTranscript = groupFiles
        .map((f) => {
          const t = store.getTranscription(f!.id);
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
        audioFileIds: group.audioFileIds,
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
