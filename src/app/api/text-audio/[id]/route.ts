import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { store } from "@/lib/store";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const artifact = store.getTextAudioArtifact(params.id);
  if (!artifact || !fs.existsSync(artifact.audioPath)) {
    return NextResponse.json({ error: "Audio file not found" }, { status: 404 });
  }

  const audio = fs.readFileSync(artifact.audioPath);
  return new NextResponse(audio, {
    headers: {
      "Content-Type": artifact.mimeType,
      "Content-Disposition": `attachment; filename="${artifact.audioFileName}"`,
      "Content-Length": String(audio.length),
    },
  });
}
