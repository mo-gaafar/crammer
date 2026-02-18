import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { store } from "@/lib/store";
import { ensureUploadDir, getUploadDir, getRecordedAt, isAllowedAudioType } from "@/lib/metadata";
import { AudioFile } from "@/types";

export async function POST(request: NextRequest) {
  try {
    ensureUploadDir();

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const savedFiles: AudioFile[] = [];
    const errors: string[] = [];

    for (const file of files) {
      if (!file.name) continue;

      const mimeType = file.type || "audio/mpeg";

      if (!isAllowedAudioType(mimeType, file.name)) {
        errors.push(`${file.name}: unsupported file type (${mimeType})`);
        continue;
      }

      const id = uuidv4();
      const ext = path.extname(file.name) || ".audio";
      const savedName = `${id}${ext}`;
      const savedPath = path.join(getUploadDir(), savedName);

      // Write file to disk
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(savedPath, buffer);

      const recordedAt = getRecordedAt(savedPath, file.name);

      const audioFile: AudioFile = {
        id,
        originalName: file.name,
        savedPath,
        mimeType,
        size: file.size,
        recordedAt: recordedAt.toISOString(),
        uploadedAt: new Date().toISOString(),
        status: "uploaded",
      };

      store.addAudioFile(audioFile);
      savedFiles.push(audioFile);
    }

    // Update status
    const all = store.getAllAudioFiles();
    store.updateStatus({
      totalFiles: all.length,
      phase: all.length > 0 ? "uploading" : "idle",
    });

    return NextResponse.json({
      uploaded: savedFiles.length,
      files: savedFiles,
      errors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Reset the store and delete all uploaded files */
export async function DELETE() {
  try {
    const files = store.getAllAudioFiles();
    for (const f of files) {
      try {
        if (fs.existsSync(f.savedPath)) fs.unlinkSync(f.savedPath);
      } catch {
        // ignore individual file deletion errors
      }
    }
    store.reset();
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const files = store.getAllAudioFiles();
  return NextResponse.json({ files });
}
