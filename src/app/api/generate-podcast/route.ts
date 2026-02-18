import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { store } from "@/lib/store";
import { generatePodcastScript } from "@/lib/gemini";
import { PodcastFormat, PodcastScript } from "@/types";

/**
 * POST /api/generate-podcast
 * Body: { lectureId: string, format: "qa" | "narrative" | "discussion" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lectureId, format } = body as { lectureId: string; format: PodcastFormat };

    if (!lectureId || !format) {
      return NextResponse.json(
        { error: "lectureId and format are required" },
        { status: 400 }
      );
    }

    const validFormats: PodcastFormat[] = ["qa", "narrative", "discussion"];
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { error: `format must be one of: ${validFormats.join(", ")}` },
        { status: 400 }
      );
    }

    const lecture = store.getLecture(lectureId);
    if (!lecture) {
      return NextResponse.json({ error: "Lecture not found" }, { status: 404 });
    }

    const audioFiles = lecture.audioFileIds
      .map((id) => store.getAudioFile(id))
      .filter(Boolean) as ReturnType<typeof store.getAudioFile>[];

    const result = await generatePodcastScript(
      lecture,
      audioFiles.filter((f) => f !== undefined) as NonNullable<typeof audioFiles[0]>[],
      lecture.fullTranscript,
      format
    );

    const script: PodcastScript = {
      id: uuidv4(),
      lectureId,
      format,
      title: result.title,
      description: result.description,
      script: result.script,
      generatedAt: new Date().toISOString(),
    };

    store.addPodcastScript(script);

    return NextResponse.json({ script });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/generate-podcast?lectureId=xxx
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lectureId = searchParams.get("lectureId");

  if (!lectureId) {
    return NextResponse.json({ error: "lectureId is required" }, { status: 400 });
  }

  const scripts = store.getPodcastScriptsForLecture(lectureId);
  return NextResponse.json({ scripts });
}
