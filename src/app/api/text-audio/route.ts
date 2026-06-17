import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { generateReadableScriptFromText } from "@/lib/gemini";
import { store } from "@/lib/store";
import { estimateTtsCost } from "@/lib/tts-cost";
import { TextAudioArtifact, TtsProvider } from "@/types";

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceName, text, geminiModel, useTextAsScript, ttsProvider } = body as {
      sourceName?: string;
      text?: string;
      geminiModel?: string;
      useTextAsScript?: boolean;
      ttsProvider?: TtsProvider;
    };

    const trimmedText = text?.trim();
    if (!trimmedText) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }
    if (trimmedText.length < 20) {
      return NextResponse.json(
        { error: "Add a little more text so StudyForge can create useful audio" },
        { status: 400 }
      );
    }

    const cleanSourceName = sourceName?.trim() || "Pasted text";
    const generated = useTextAsScript
      ? {
          title: cleanSourceName.replace(/\.[^.]+$/, "") || "Pasted Script",
          script: trimmedText,
        }
      : await generateReadableScriptFromText(
          cleanSourceName,
          trimmedText,
          geminiModel
        );
    const id = uuidv4();

    const artifact: TextAudioArtifact = {
      id,
      sourceName: cleanSourceName,
      title: generated.title,
      script: generated.script,
      ttsProvider: ttsProvider === "deepgram" ? "deepgram" : "gemini",
      ttsCostEstimate: estimateTtsCost(generated.script),
      mimeType: "audio/wav",
      createdAt: new Date().toISOString(),
    };

    store.addTextAudioArtifact(artifact);

    return NextResponse.json({
      artifact: serializeTextAudioArtifact(artifact),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const artifacts = store.getAllTextAudioArtifacts().map(serializeTextAudioArtifact);

  return NextResponse.json({ artifacts });
}
