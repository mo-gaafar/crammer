import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { getOptionalClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await getOptionalClient();
  const lecture = store.getLecture(params.id);
  if (!lecture) {
    return NextResponse.json({ error: "Lecture not found" }, { status: 404 });
  }

  const audioFiles = (
    await Promise.all(lecture.audioFileIds.map((id) => store.getAudioFile(supabase, id)))
  ).filter(Boolean);

  const transcriptions = (
    await Promise.all(lecture.audioFileIds.map((id) => store.getTranscription(supabase, id)))
  ).filter(Boolean);

  const podcastScripts = store.getPodcastScriptsForLecture(lecture.id);
  const studyMaterials = store.getStudyMaterialsForLecture(lecture.id);

  return NextResponse.json({
    lecture,
    audioFiles,
    transcriptions,
    podcastScripts,
    studyMaterials,
  });
}
