import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { store } from "@/lib/store";
import { getOptionalClient } from "@/lib/supabase/server";
import { transcribeAudioFile } from "@/lib/deepgram";
import { transcribeWithGemini, DEFAULT_GEMINI_MODEL } from "@/lib/gemini";
import { isVideoMimeType, extractAudioFromVideo } from "@/lib/video";

/**
 * POST /api/transcribe
 * Body: { fileIds?: string[], sttProvider?: "deepgram" | "gemini", geminiModel?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getOptionalClient();
    const body = await request.json().catch(() => ({}));
    const fileIds: string[] | undefined = body.fileIds;
    const sttProvider: "deepgram" | "gemini" = body.sttProvider ?? "deepgram";
    const geminiModel: string = body.geminiModel ?? DEFAULT_GEMINI_MODEL;

    // Recover any files that got stuck in "transcribing" from a previous crashed request
    const allFiles = await store.getAllAudioFiles(supabase);
    await Promise.all(
      allFiles
        .filter((f) => f.status === "transcribing")
        .map((f) => store.updateAudioFile(supabase, f.id, { status: "uploaded" }))
    );

    const freshFiles = await store.getAllAudioFiles(supabase);
    const toTranscribe = fileIds
      ? freshFiles.filter((f) => fileIds.includes(f.id) && f.status === "uploaded")
      : freshFiles.filter((f) => f.status === "uploaded");

    if (toTranscribe.length === 0) {
      return NextResponse.json({ message: "No files to transcribe", transcribed: 0 });
    }

    store.updateStatus({ phase: "transcribing" });

    const results: { id: string; status: string; transcript?: string; error?: string }[] = [];

    for (const file of toTranscribe) {
      await store.updateAudioFile(supabase, file.id, { status: "transcribing" });

      try {
        let transcribePath = file.savedPath;
        let transcribeMimeType = file.mimeType;

        if (isVideoMimeType(file.mimeType)) {
          const audioPath = await extractAudioFromVideo(file.savedPath, file.id);
          await store.updateAudioFile(supabase, file.id, { extractedAudioPath: audioPath });
          transcribePath = audioPath;
          transcribeMimeType = "audio/mpeg";
        }

        const transcription =
          sttProvider === "gemini"
            ? await transcribeWithGemini(transcribePath, file.id, transcribeMimeType, geminiModel)
            : await transcribeAudioFile(transcribePath, file.id, transcribeMimeType);

        // Clean up extracted audio now that transcription is done
        const extractedPath = (await store.getAudioFile(supabase, file.id))?.extractedAudioPath;
        if (extractedPath) {
          try { fs.unlinkSync(extractedPath); } catch { /* ignore */ }
          await store.updateAudioFile(supabase, file.id, { extractedAudioPath: undefined });
        }

        await store.addTranscription(supabase, transcription);
        await store.updateAudioFile(supabase, file.id, { status: "transcribed" });
        results.push({ id: file.id, status: "transcribed", transcript: transcription.text });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await store.updateAudioFile(supabase, file.id, { status: "error", errorMessage: message });
        results.push({ id: file.id, status: "error", error: message });
      }

      const transcribed = (await store.getAllAudioFiles(supabase)).filter(
        (f) => f.status === "transcribed"
      ).length;
      store.updateStatus({ transcribedFiles: transcribed });
    }

    const allDone = (await store.getAllAudioFiles(supabase)).every(
      (f) => f.status === "transcribed" || f.status === "error"
    );

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
