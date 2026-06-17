import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { store } from "@/lib/store";
import { estimateTtsCost } from "@/lib/tts-cost";
import { enqueueScriptJob, serializeTextAudioArtifact } from "@/lib/text-audio-queue";
import { TextAudioArtifact, TtsProvider } from "@/types";

interface BatchItem {
  sourceName?: string;
  text?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, geminiModel, useTextAsScript, ttsProvider } = body as {
      items?: BatchItem[];
      geminiModel?: string;
      useTextAsScript?: boolean;
      ttsProvider?: TtsProvider;
    };

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "At least one document is required" }, { status: 400 });
    }

    const resolvedTtsProvider: TtsProvider = ttsProvider === "deepgram" ? "deepgram" : "gemini";
    const created: TextAudioArtifact[] = [];
    const skipped: string[] = [];

    for (const item of items) {
      const trimmedText = item.text?.trim();
      const cleanSourceName = item.sourceName?.trim() || "Untitled document";

      if (!trimmedText || trimmedText.length < 20) {
        skipped.push(cleanSourceName);
        continue;
      }

      const id = uuidv4();
      const createdAt = new Date().toISOString();

      const artifact: TextAudioArtifact = useTextAsScript
        ? {
            id,
            sourceName: cleanSourceName,
            title: cleanSourceName.replace(/\.[^.]+$/, "") || "Pasted Script",
            script: trimmedText,
            ttsProvider: resolvedTtsProvider,
            ttsCostEstimate: estimateTtsCost(trimmedText),
            mimeType: "audio/wav",
            createdAt,
            scriptStatus: "ready",
          }
        : {
            id,
            sourceName: cleanSourceName,
            title: cleanSourceName.replace(/\.[^.]+$/, "") || "Untitled document",
            script: "",
            rawText: trimmedText,
            ttsProvider: resolvedTtsProvider,
            mimeType: "audio/wav",
            createdAt,
            scriptStatus: "pending",
          };

      store.addTextAudioArtifact(artifact);
      if (!useTextAsScript) {
        enqueueScriptJob(id, geminiModel);
      }
      created.push(artifact);
    }

    if (created.length === 0) {
      return NextResponse.json(
        { error: "None of the documents had enough text to queue" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        artifacts: created.map(serializeTextAudioArtifact),
        skipped,
      },
      { status: 202 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
