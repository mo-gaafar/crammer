import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET() {
  const status = store.getStatus();
  const audioFiles = store.getAllAudioFiles();
  const lectures = store.getAllLectures();

  return NextResponse.json({
    status,
    files: audioFiles.map((f) => {
      const transcription = store.getTranscription(f.id);
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
