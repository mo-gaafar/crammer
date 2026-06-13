import { spawn } from "child_process";
import path from "path";
import { getUploadDir } from "./metadata";

export function isVideoMimeType(mimeType: string): boolean {
  // video/webm can be audio-only, but we treat all video/* as needing extraction
  return mimeType.startsWith("video/");
}

/**
 * Extracts audio from a video file using ffmpeg and saves it as MP3.
 * Returns the path to the extracted audio file.
 */
export async function extractAudioFromVideo(
  videoPath: string,
  fileId: string
): Promise<string> {
  const outputPath = path.join(getUploadDir(), `${fileId}-audio.mp3`);

  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", [
      "-i", videoPath,
      "-vn",               // strip video stream
      "-acodec", "libmp3lame",
      "-q:a", "2",         // high-quality VBR
      "-y",                // overwrite output if exists
      outputPath,
    ]);

    let stderr = "";
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(
          new Error(
            `ffmpeg exited with code ${code}. ${stderr.slice(-500)}`
          )
        );
      }
    });

    proc.on("error", (err) => {
      reject(
        new Error(
          `Failed to start ffmpeg: ${err.message}. Make sure ffmpeg is installed on the server.`
        )
      );
    });
  });
}
