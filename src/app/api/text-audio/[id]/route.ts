import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { store } from "@/lib/store";
import { ensureUploadDir, getUploadDir } from "@/lib/metadata";
import { synthesizeScriptAudio } from "@/lib/gemini";

function safeFileStem(name: string): string {
  const stem = path.basename(name, path.extname(name)).trim() || "pasted-text";
  return stem
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80)
    .toLowerCase() || "pasted_text";
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const artifact = store.getTextAudioArtifact(params.id);
  if (!artifact || !artifact.audioPath || !fs.existsSync(artifact.audioPath)) {
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

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    ensureUploadDir();

    const artifact = store.getTextAudioArtifact(params.id);
    if (!artifact) {
      return NextResponse.json({ error: "Script not found" }, { status: 404 });
    }

    const audio = await synthesizeScriptAudio(artifact.script);
    const audioFileName = `${safeFileStem(artifact.sourceName)}_script_audio.wav`;
    const audioPath = path.join(getUploadDir(), `${artifact.id}.wav`);
    fs.writeFileSync(audioPath, audio);

    store.updateTextAudioArtifact(artifact.id, {
      audioPath,
      audioFileName,
      audioError: undefined,
    });

    return NextResponse.json({
      artifact: {
        ...artifact,
        audioFileName,
        audioUrl: `/api/text-audio/${artifact.id}`,
        audioError: undefined,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    store.updateTextAudioArtifact(params.id, { audioError: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
