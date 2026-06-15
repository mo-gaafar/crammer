import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { generateReadableScriptFromText } from "@/lib/gemini";
import { store } from "@/lib/store";
import { TextAudioArtifact } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceName, text, geminiModel } = body as {
      sourceName?: string;
      text?: string;
      geminiModel?: string;
    };

    const trimmedText = text?.trim();
    if (!trimmedText) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }
    if (trimmedText.length < 20) {
      return NextResponse.json(
        { error: "Add a little more text so Crammer can create a useful script" },
        { status: 400 }
      );
    }

    const cleanSourceName = sourceName?.trim() || "Pasted text";
    const generated = await generateReadableScriptFromText(
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
      mimeType: "audio/wav",
      createdAt: new Date().toISOString(),
    };

    store.addTextAudioArtifact(artifact);

    return NextResponse.json({
      artifact: {
        id: artifact.id,
        sourceName: artifact.sourceName,
        title: artifact.title,
        script: artifact.script,
        audioFileName: artifact.audioFileName,
        mimeType: artifact.mimeType,
        createdAt: artifact.createdAt,
        audioUrl: artifact.audioPath ? `/api/text-audio/${artifact.id}` : null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const artifacts = store.getAllTextAudioArtifacts().map((artifact) => ({
    id: artifact.id,
    sourceName: artifact.sourceName,
    title: artifact.title,
    script: artifact.script,
    audioFileName: artifact.audioFileName,
    mimeType: artifact.mimeType,
    createdAt: artifact.createdAt,
    audioUrl: artifact.audioPath ? `/api/text-audio/${artifact.id}` : null,
    audioError: artifact.audioError,
  }));

  return NextResponse.json({ artifacts });
}
