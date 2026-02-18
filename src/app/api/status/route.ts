import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET() {
  const status = store.getStatus();
  const audioFiles = store.getAllAudioFiles();
  const lectures = store.getAllLectures();

  return NextResponse.json({
    status,
    files: audioFiles.map((f) => ({
      id: f.id,
      name: f.originalName,
      status: f.status,
      errorMessage: f.errorMessage,
      recordedAt: f.recordedAt,
      size: f.size,
    })),
    lectureCount: lectures.length,
  });
}
