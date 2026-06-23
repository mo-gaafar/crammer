import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { getOptionalClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await getOptionalClient();
  const status = store.getStatus();
  const audioFiles = await store.getAllAudioFiles(supabase);
  const transcriptionsById = new Map(
    (await store.getAllTranscriptions(supabase)).map((t) => [t.audioFileId, t])
  );
  const lectures = store.getAllLectures();

  return NextResponse.json({
    status,
    files: audioFiles.map((f) => {
      const transcription = transcriptionsById.get(f.id);
      return {
        id: f.id,
        name: f.originalName,
        size: f.size,
        status: f.status === "transcribing" ? "uploaded" : f.status, // unstick crashed files
        errorMessage: f.errorMessage,
        recordedAt: f.recordedAt,
        transcript: transcription?.text,
      };
    }),
    lectureCount: lectures.length,
  });
}
