import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { enqueueScriptJob, serializeTextAudioArtifact } from "@/lib/text-audio-queue";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const artifact = store.getTextAudioArtifact(params.id);
  if (!artifact) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (artifact.scriptStatus === "ready") {
    return NextResponse.json({ artifact: serializeTextAudioArtifact(artifact) });
  }

  if (artifact.scriptStatus === "pending" || artifact.scriptStatus === "generating") {
    return NextResponse.json({ artifact: serializeTextAudioArtifact(artifact) }, { status: 202 });
  }

  const body = await request.json().catch(() => ({}));
  const geminiModel = (body as { geminiModel?: string }).geminiModel;

  enqueueScriptJob(artifact.id, geminiModel);

  const updated = store.getTextAudioArtifact(artifact.id);
  return NextResponse.json(
    { artifact: updated ? serializeTextAudioArtifact(updated) : null },
    { status: 202 }
  );
}
