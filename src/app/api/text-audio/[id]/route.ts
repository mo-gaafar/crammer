import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { store } from "@/lib/store";
import { ensureUploadDir, getUploadDir } from "@/lib/metadata";
import { synthesizeScriptAudio } from "@/lib/gemini";
import { synthesizeWithDeepgram } from "@/lib/deepgram";
import { countScriptAudioChunks } from "@/lib/tts-utils";
import { estimateTtsCost } from "@/lib/tts-cost";
import { TextAudioArtifact } from "@/types";

interface TextAudioQueue {
  ids: string[];
  processing: boolean;
}

declare global {
  // eslint-disable-next-line no-var
  var __crammerTextAudioQueue: TextAudioQueue | undefined;
}

function getAudioQueue(): TextAudioQueue {
  if (!global.__crammerTextAudioQueue) {
    global.__crammerTextAudioQueue = { ids: [], processing: false };
  }
  return global.__crammerTextAudioQueue;
}

function safeFileStem(name: string): string {
  const stem = path.basename(name, path.extname(name)).trim() || "pasted-text";
  return stem
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80)
    .toLowerCase() || "pasted_text";
}

function serializeTextAudioArtifact(artifact: TextAudioArtifact) {
  return {
    id: artifact.id,
    sourceName: artifact.sourceName,
    title: artifact.title,
    script: artifact.script,
    ttsProvider: artifact.ttsProvider ?? "gemini",
    ttsCostEstimate: artifact.ttsCostEstimate ?? estimateTtsCost(artifact.script),
    audioFileName: artifact.audioFileName,
    mimeType: artifact.mimeType,
    createdAt: artifact.createdAt,
    audioStatus: artifact.audioStatus,
    audioChunksDone: artifact.audioChunksDone,
    audioChunksTotal: artifact.audioChunksTotal,
    audioUrl: artifact.audioPath ? `/api/text-audio/${artifact.id}` : null,
    audioError: artifact.audioError,
  };
}

async function runAudioJob(artifactId: string): Promise<void> {
  const artifact = store.getTextAudioArtifact(artifactId);
  if (!artifact) return;

  try {
    const synthesize = artifact.ttsProvider === "deepgram" ? synthesizeWithDeepgram : synthesizeScriptAudio;
    const audio = await synthesize(artifact.script, ({ done, total }) => {
      store.updateTextAudioArtifact(artifact.id, {
        audioStatus: "generating",
        audioChunksDone: done,
        audioChunksTotal: total,
      });
    });
    const audioFileName = `${safeFileStem(artifact.sourceName)}_script_audio.wav`;
    const audioPath = path.join(getUploadDir(), `${artifact.id}.wav`);
    fs.writeFileSync(audioPath, audio);

    const total = store.getTextAudioArtifact(artifact.id)?.audioChunksTotal ?? countScriptAudioChunks(artifact.script);
    store.updateTextAudioArtifact(artifact.id, {
      audioPath,
      audioFileName,
      audioStatus: "complete",
      audioChunksDone: total,
      audioChunksTotal: total,
      audioError: undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    store.updateTextAudioArtifact(artifactId, { audioStatus: "error", audioError: message });
  }
}

async function processAudioQueue(): Promise<void> {
  const queue = getAudioQueue();
  if (queue.processing) return;

  queue.processing = true;
  try {
    while (queue.ids.length > 0) {
      const artifactId = queue.ids.shift();
      if (!artifactId) continue;

      const artifact = store.getTextAudioArtifact(artifactId);
      if (!artifact || artifact.audioPath || artifact.audioStatus === "complete") continue;

      store.updateTextAudioArtifact(artifactId, {
        audioStatus: "generating",
        audioChunksDone: 0,
        audioChunksTotal: artifact.audioChunksTotal ?? countScriptAudioChunks(artifact.script),
        audioError: undefined,
      });

      await runAudioJob(artifactId);
    }
  } finally {
    queue.processing = false;
  }
}

function enqueueAudioJob(artifactId: string): void {
  const queue = getAudioQueue();
  if (!queue.ids.includes(artifactId)) {
    queue.ids.push(artifactId);
  }
  void processAudioQueue();
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
