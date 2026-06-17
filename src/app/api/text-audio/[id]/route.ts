import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { store } from "@/lib/store";
import { ensureUploadDir } from "@/lib/metadata";
import { countScriptAudioChunks } from "@/lib/tts-utils";
import { enqueueAudioJob, serializeTextAudioArtifact } from "@/lib/text-audio-queue";

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

    if (artifact.scriptStatus === "pending" || artifact.scriptStatus === "generating") {
      return NextResponse.json(
        { error: "Script isn't ready yet" },
        { status: 409 }
      );
    }

    if (artifact.audioPath && fs.existsSync(artifact.audioPath)) {
      return NextResponse.json({ artifact: serializeTextAudioArtifact(artifact) });
    }

    if (artifact.audioStatus === "queued" || artifact.audioStatus === "generating") {
      return NextResponse.json({ artifact: serializeTextAudioArtifact(artifact) }, { status: 202 });
    }

    const total = countScriptAudioChunks(artifact.script);
    if (total === 0) {
      return NextResponse.json({ error: "Script is empty" }, { status: 400 });
    }

    store.updateTextAudioArtifact(artifact.id, {
      audioStatus: "queued",
      audioChunksDone: 0,
      audioChunksTotal: total,
      audioError: undefined,
    });

    enqueueAudioJob(artifact.id);

    const updated = store.getTextAudioArtifact(artifact.id);
    return NextResponse.json({
      artifact: updated ? serializeTextAudioArtifact(updated) : null,
    }, { status: 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    store.updateTextAudioArtifact(params.id, { audioStatus: "error", audioError: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const artifact = store.getTextAudioArtifact(params.id);
  if (!artifact) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (artifact.audioPath && fs.existsSync(artifact.audioPath)) {
    fs.unlinkSync(artifact.audioPath);
  }

  store.deleteTextAudioArtifact(params.id);
  return NextResponse.json({ ok: true });
}
