import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { transcribeAudioFile } from "@/lib/deepgram";
import { transcribeWithGemini, DEFAULT_GEMINI_MODEL } from "@/lib/gemini";

/**
 * POST /api/transcribe
 * Body: { fileIds?: string[], sttProvider?: "deepgram" | "gemini", geminiModel?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const fileIds: string[] | undefined = body.fileIds;
    const sttProvider: "deepgram" | "gemini" = body.sttProvider ?? "deepgram";
    const geminiModel: string = body.geminiModel ?? DEFAULT_GEMINI_MODEL;

    // Recover any files that got stuck in "transcribing" from a previous crashed request
    const allFiles = store.getAllAudioFiles();
    allFiles
      .filter((f) => f.status === "transcribing")
      .forEach((f) => store.updateAudioFile(f.id, { status: "uploaded" }));

    const freshFiles = store.getAllAudioFiles();
    const toTranscribe = fileIds
      ? freshFiles.filter((f) => fileIds.includes(f.id) && f.status === "uploaded")
      : freshFiles.filter((f) => f.status === "uploaded");

    if (toTranscribe.length === 0) {
      return NextResponse.json({ message: "No files to transcribe", transcribed: 0 });
    }

    store.updateStatus({ phase: "transcribing" });

    const results: { id: string; status: string; transcript?: string; error?: string }[] = [];

    for (const file of toTranscribe) {
      store.updateAudioFile(file.id, { status: "transcribing" });

      try {
        const transcription =
          sttProvider === "gemini"
            ? await transcribeWithGemini(file.savedPath, file.id, file.mimeType, geminiModel)
            : await transcribeAudioFile(file.savedPath, file.id, file.mimeType);

        store.addTranscription(transcription);
        store.updateAudioFile(file.id, { status: "transcribed" });
        results.push({ id: file.id, status: "transcribed", transcript: transcription.text });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        store.updateAudioFile(file.id, { status: "error", errorMessage: message });
        results.push({ id: file.id, status: "error", error: message });
      }

      const transcribed = store
        .getAllAudioFiles()
        .filter((f) => f.status === "transcribed").length;
      store.updateStatus({ transcribedFiles: transcribed });
    }

    const allDone = store
      .getAllAudioFiles()
      .every((f) => f.status === "transcribed" || f.status === "error");

    if (allDone) {
      store.updateStatus({ phase: "processing" });
    }

    return NextResponse.json({
      transcribed: results.filter((r) => r.status === "transcribed").length,
      failed: results.filter((r) => r.status === "error").length,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    store.updateStatus({ phase: "error", errorMessage: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
