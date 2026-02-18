import fs from "fs";
import path from "path";

/**
 * Attempt to extract a recording date from a filename.
 * Supports patterns like:
 *   2024-01-15_lecture.m4a
 *   20240115 bio notes.mp3
 *   Lecture 2024_03_22.wav
 *   Jan 15 2024.ogg
 */
export function parseDateFromFilename(filename: string): Date | null {
  const base = path.basename(filename, path.extname(filename));

  // YYYY-MM-DD or YYYY_MM_DD
  const ymd = base.match(/(\d{4})[_\-\.](\d{2})[_\-\.](\d{2})/);
  if (ymd) {
    const d = new Date(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3]));
    if (!isNaN(d.getTime()) && parseInt(ymd[1]) > 2000) return d;
  }

  // YYYYMMDD (8 consecutive digits)
  const compact = base.match(/(?<!\d)(\d{4})(\d{2})(\d{2})(?!\d)/);
  if (compact) {
    const y = parseInt(compact[1]);
    const m = parseInt(compact[2]);
    const dy = parseInt(compact[3]);
    if (y > 2000 && m >= 1 && m <= 12 && dy >= 1 && dy <= 31) {
      const d = new Date(y, m - 1, dy);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // Month name patterns: "Jan 15 2024", "15 Jan 2024", "January 15 2024"
  const monthNames = [
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec",
  ];
  const monthFull = [
    "january","february","march","april","may","june",
    "july","august","september","october","november","december",
  ];

  const lower = base.toLowerCase();
  for (let i = 0; i < monthNames.length; i++) {
    const shortPattern = new RegExp(`(${monthNames[i]})[a-z]*\\s*(\\d{1,2})[,\\s]+(\\d{4})`, "i");
    const m1 = lower.match(shortPattern);
    if (m1) {
      const d = new Date(`${monthFull[i]} ${m1[2]} ${m1[3]}`);
      if (!isNaN(d.getTime())) return d;
    }
    const reversePattern = new RegExp(`(\\d{1,2})\\s+(${monthNames[i]})[a-z]*[,\\s]+(\\d{4})`, "i");
    const m2 = lower.match(reversePattern);
    if (m2) {
      const d = new Date(`${monthFull[i]} ${m2[1]} ${m2[3]}`);
      if (!isNaN(d.getTime())) return d;
    }
  }

  return null;
}

/**
 * Extract a sequence/order number from a filename for tie-breaking sort.
 * Detects patterns like: "01_lecture", "part2", "lecture_03", "1 bio notes"
 */
export function parseSequenceFromFilename(filename: string): number | null {
  const base = path.basename(filename, path.extname(filename));

  // Leading number: "01_lecture", "1 bio notes", "01-recording"
  const leading = base.match(/^(\d+)[_\-\s]/);
  if (leading) return parseInt(leading[1], 10);

  // "partN", "part_N", "part-N", "part N" (anywhere in filename)
  const part = base.match(/\bpart[_\-\s]*(\d+)\b/i);
  if (part) return parseInt(part[1], 10);

  // Trailing number: "lecture_01", "bio 3", "session-02"
  const trailing = base.match(/[_\-\s](\d+)$/);
  if (trailing) return parseInt(trailing[1], 10);

  // Bare number filename: "01", "1", "001"
  const bare = base.match(/^(\d+)$/);
  if (bare) return parseInt(bare[1], 10);

  return null;
}

/**
 * Get the best estimate for when an audio file was recorded.
 * Priority: parsed filename date > file mtime
 */
export function getRecordedAt(filePath: string, originalName: string): Date {
  const fromName = parseDateFromFilename(originalName);
  if (fromName) return fromName;

  const stat = fs.statSync(filePath);
  return stat.mtime;
}

export const ALLOWED_AUDIO_TYPES: Record<string, string> = {
  "audio/mpeg": ".mp3",
  "audio/mp4": ".mp4",
  "audio/x-m4a": ".m4a",
  "audio/m4a": ".m4a",
  "audio/wav": ".wav",
  "audio/wave": ".wav",
  "audio/x-wav": ".wav",
  "audio/ogg": ".ogg",
  "audio/webm": ".webm",
  "audio/flac": ".flac",
  "audio/x-flac": ".flac",
  "video/mp4": ".mp4", // some recorders save as mp4
  "video/webm": ".webm",
};

export function isAllowedAudioType(mimeType: string, filename: string): boolean {
  if (ALLOWED_AUDIO_TYPES[mimeType]) return true;
  const ext = path.extname(filename).toLowerCase();
  const allowed = [".mp3", ".mp4", ".m4a", ".wav", ".ogg", ".webm", ".flac", ".aac", ".opus"];
  return allowed.includes(ext);
}

export function getUploadDir(): string {
  return "/tmp/crammer-uploads";
}

export function ensureUploadDir(): void {
  const dir = getUploadDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
