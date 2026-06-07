import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { store } from "@/lib/store";
import { ensureUploadDir, getUploadDir, getRecordedAt, isAllowedAudioType } from "@/lib/metadata";
import { AudioFile } from "@/types";

export interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  modifiedTime?: string;
}

function extractFolderId(input: string): string | null {
  const trimmed = input.trim();
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  const openMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch) return openMatch[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  return null;
}

function getApiKey() {
  return process.env.GOOGLE_DRIVE_API_KEY ?? process.env.GEMINI_API_KEY ?? null;
}

async function listDriveFiles(folderId: string, apiKey: string): Promise<{ files?: DriveFileInfo[]; error?: string; status?: number }> {
  const q = `'${folderId}' in parents and (mimeType contains 'audio' or mimeType = 'video/mp4' or mimeType = 'video/webm') and trashed = false`;
  const fields = "files(id,name,mimeType,size,modifiedTime)";
  const listUrl =
    `https://www.googleapis.com/drive/v3/files` +
    `?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&pageSize=100&key=${apiKey}`;

  const listRes = await fetch(listUrl, { signal: AbortSignal.timeout(30_000) });
  if (!listRes.ok) {
    const err = await listRes.json().catch(() => ({}));
    const msg = (err as { error?: { message?: string } }).error?.message ?? listRes.statusText;
    return { error: `Drive API: ${msg}`, status: listRes.status };
  }

  const listData = (await listRes.json()) as {
    files: { id: string; name: string; mimeType: string; size?: string; modifiedTime?: string }[];
  };

  const files: DriveFileInfo[] = (listData.files ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: f.size ? parseInt(f.size) : 0,
    modifiedTime: f.modifiedTime,
  }));

  return { files };
}

/**
 * GET /api/drive?folderUrl=...
 * Lists audio files in a public Google Drive folder without downloading them.
 */
export async function GET(request: NextRequest) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "GOOGLE_DRIVE_API_KEY is not set" }, { status: 500 });
  }

  const folderUrl = request.nextUrl.searchParams.get("folderUrl");
  if (!folderUrl) {
    return NextResponse.json({ error: "folderUrl query param is required" }, { status: 400 });
  }

  const folderId = extractFolderId(folderUrl);
  if (!folderId) {
    return NextResponse.json({ error: "Could not find a folder ID in the provided URL" }, { status: 400 });
  }

  const result = await listDriveFiles(folderId, apiKey);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 });
  }

  const existingNames = new Set(store.getAllAudioFiles().map((f) => f.originalName));
  const files = (result.files ?? []).map((f) => ({
    ...f,
    alreadyImported: existingNames.has(f.name),
    supported: isAllowedAudioType(f.mimeType, f.name),
  }));

  return NextResponse.json({ files });
}

/**
 * POST /api/drive
 * Body: { folderUrl: string; fileIds: string[] }
 * Downloads and imports the specified files from a public Google Drive folder.
 */
export async function POST(request: NextRequest) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "GOOGLE_DRIVE_API_KEY is not set" }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const { folderUrl, fileIds } = body as { folderUrl?: string; fileIds?: string[] };

  if (!folderUrl) {
    return NextResponse.json({ error: "folderUrl is required" }, { status: 400 });
  }
  if (!fileIds || fileIds.length === 0) {
    return NextResponse.json({ error: "fileIds is required and must not be empty" }, { status: 400 });
  }

  const folderId = extractFolderId(folderUrl);
  if (!folderId) {
    return NextResponse.json({ error: "Could not find a folder ID in the provided URL" }, { status: 400 });
  }

  // Re-list to get metadata for the selected files
  const result = await listDriveFiles(folderId, apiKey);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 });
  }

  const selectedSet = new Set(fileIds);
  const toDownload = (result.files ?? []).filter((f) => selectedSet.has(f.id));

  if (toDownload.length === 0) {
    return NextResponse.json({ error: "None of the selected file IDs were found in the folder" }, { status: 400 });
  }

  ensureUploadDir();

  const existingNames = new Set(store.getAllAudioFiles().map((f) => f.originalName));
  const savedFiles: AudioFile[] = [];
  const errors: string[] = [];
  const skipped: string[] = [];

  for (const driveFile of toDownload) {
    if (existingNames.has(driveFile.name)) {
      skipped.push(driveFile.name);
      continue;
    }

    if (!isAllowedAudioType(driveFile.mimeType, driveFile.name)) {
      errors.push(`${driveFile.name}: unsupported type (${driveFile.mimeType})`);
      continue;
    }

    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${driveFile.id}?alt=media&key=${apiKey}`;
    const dlRes = await fetch(downloadUrl, { signal: AbortSignal.timeout(180_000) });
    if (!dlRes.ok) {
      errors.push(`${driveFile.name}: download failed (${dlRes.status} ${dlRes.statusText})`);
      continue;
    }

    const id = uuidv4();
    const ext = path.extname(driveFile.name) || ".audio";
    const savedPath = path.join(getUploadDir(), `${id}${ext}`);

    const buffer = Buffer.from(await dlRes.arrayBuffer());
    fs.writeFileSync(savedPath, buffer);

    const recordedAt = driveFile.modifiedTime
      ? new Date(driveFile.modifiedTime)
      : getRecordedAt(savedPath, driveFile.name);

    const audioFile: AudioFile = {
      id,
      originalName: driveFile.name,
      savedPath,
      mimeType: driveFile.mimeType,
      size: driveFile.size || buffer.length,
      recordedAt: recordedAt.toISOString(),
      uploadedAt: new Date().toISOString(),
      status: "uploaded",
    };

    store.addAudioFile(audioFile);
    savedFiles.push(audioFile);
  }

  store.updateStatus({
    totalFiles: store.getAllAudioFiles().length,
    phase: store.getAllAudioFiles().length > 0 ? "uploading" : "idle",
  });

  return NextResponse.json({
    imported: savedFiles.length,
    skipped: skipped.length,
    files: savedFiles,
    errors,
  });
}
