import fs from "fs";
import path from "path";
import { generateReadableScriptFromText, synthesizeScriptAudio } from "@/lib/gemini";
import { synthesizeWithDeepgram } from "@/lib/deepgram";
import { getUploadDir } from "@/lib/metadata";
import { store } from "@/lib/store";
import { estimateTtsCost } from "@/lib/tts-cost";
import { countScriptAudioChunks } from "@/lib/tts-utils";
import { TextAudioArtifact } from "@/types";

interface TextAudioJobQueue {
  ids: string[];
  processing: boolean;
}

declare global {
  // eslint-disable-next-line no-var
  var __crammerTextAudioQueue: TextAudioJobQueue | undefined;
  // eslint-disable-next-line no-var
  var __crammerScriptQueue: TextAudioJobQueue | undefined;
}

function getAudioQueue(): TextAudioJobQueue {
  if (!global.__crammerTextAudioQueue) {
    global.__crammerTextAudioQueue = { ids: [], processing: false };
  }
  return global.__crammerTextAudioQueue;
}

function getScriptQueue(): TextAudioJobQueue {
  if (!global.__crammerScriptQueue) {
    global.__crammerScriptQueue = { ids: [], processing: false };
  }
  return global.__crammerScriptQueue;
}

export function safeFileStem(name: string): string {
  const stem = path.basename(name, path.extname(name)).trim() || "pasted-text";
  return (
    stem
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80)
      .toLowerCase() || "pasted_text"
  );
}

export function serializeTextAudioArtifact(artifact: TextAudioArtifact) {
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
    scriptStatus: artifact.scriptStatus ?? "ready",
    scriptError: artifact.scriptError,
    audioStatus: artifact.audioStatus,
    audioChunksDone: artifact.audioChunksDone,
    audioChunksTotal: artifact.audioChunksTotal,
    audioUrl: artifact.audioPath ? `/api/text-audio/${artifact.id}` : null,
    audioError: artifact.audioError,
  };
}

async function runScriptJob(artifactId: string, geminiModel?: string): Promise<void> {
  const artifact = store.getTextAudioArtifact(artifactId);
  if (!artifact) return;

  try {
    const generated = await generateReadableScriptFromText(
      artifact.sourceName,
      artifact.rawText ?? "",
      geminiModel
    );
    store.updateTextAudioArtifact(artifact.id, {
      title: generated.title,
      script: generated.script,
      ttsCostEstimate: estimateTtsCost(generated.script),
      scriptStatus: "ready",
      scriptError: undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    store.updateTextAudioArtifact(artifactId, { scriptStatus: "error", scriptError: message });
  }
}

async function processScriptQueue(): Promise<void> {
  const queue = getScriptQueue();
  if (queue.processing) return;

  queue.processing = true;
  try {
    while (queue.ids.length > 0) {
      const entry = queue.ids.shift();
      if (!entry) continue;
      const [artifactId, geminiModel] = entry.split("::");

      const artifact = store.getTextAudioArtifact(artifactId);
      if (!artifact || artifact.scriptStatus === "ready") continue;

      store.updateTextAudioArtifact(artifactId, { scriptStatus: "generating", scriptError: undefined });
      await runScriptJob(artifactId, geminiModel || undefined);
    }
  } finally {
    queue.processing = false;
  }
}

export function enqueueScriptJob(artifactId: string, geminiModel?: string): void {
  const queue = getScriptQueue();
  const entry = `${artifactId}::${geminiModel ?? ""}`;
  if (!queue.ids.some((id) => id.startsWith(`${artifactId}::`))) {
    queue.ids.push(entry);
  }
  store.updateTextAudioArtifact(artifactId, { scriptStatus: "pending", scriptError: undefined });
  void processScriptQueue();
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

export function enqueueAudioJob(artifactId: string): void {
  const queue = getAudioQueue();
  if (!queue.ids.includes(artifactId)) {
    queue.ids.push(artifactId);
  }
  void processAudioQueue();
}
