import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { generateReadableScriptFromText, synthesizeScriptAudio } from "@/lib/gemini";
import { ensureUploadDir, getUploadDir } from "@/lib/metadata";
import { store } from "@/lib/store";
import { TextAudioArtifact } from "@/types";

function safeFileStem(name: string): string {
  const stem = path.basename(name, path.extname(name)).trim() || "pasted-text";
  return stem
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80)
    .toLowerCase() || "pasted_text";
}

export async function POST(request: NextRequest) {
  try {
    ensureUploadDir();

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
    const audio = await synthesizeScriptAudio(generated.script);

    const id = uuidv4();
    const audioFileName = `${safeFileStem(cleanSourceName)}_script_audio.wav`;
    const audioPath = path.join(getUploadDir(), `${id}.wav`);
    fs.writeFileSync(audioPath, audio);

    const artifact: TextAudioArtifact = {
      id,
      sourceName: cleanSourceName,
      title: generated.title,
      script: generated.script,
      audioPath,
      audioFileName,
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
        audioUrl: `/api/text-audio/${artifact.id}`,
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
    audioUrl: `/api/text-audio/${artifact.id}`,
  }));

  return NextResponse.json({ artifacts });
}
