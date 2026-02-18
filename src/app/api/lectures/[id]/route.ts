import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const lecture = store.getLecture(params.id);
  if (!lecture) {
    return NextResponse.json({ error: "Lecture not found" }, { status: 404 });
  }

  const audioFiles = lecture.audioFileIds
    .map((id) => store.getAudioFile(id))
    .filter(Boolean);

  const transcriptions = lecture.audioFileIds
    .map((id) => store.getTranscription(id))
    .filter(Boolean);

  const podcastScripts = store.getPodcastScriptsForLecture(lecture.id);

  return NextResponse.json({
    lecture,
    audioFiles,
    transcriptions,
    podcastScripts,
  });
}
