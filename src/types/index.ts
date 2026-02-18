export interface AudioFile {
  id: string;
  originalName: string;
  savedPath: string;
  mimeType: string;
  size: number;
  /** Best-guess recording date (from filename pattern or file mtime) */
  recordedAt: string; // ISO string
  uploadedAt: string; // ISO string
  status: "uploaded" | "transcribing" | "transcribed" | "error";
  errorMessage?: string;
}

export interface TranscriptionWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: number;
}

export interface Transcription {
  audioFileId: string;
  text: string;
  words: TranscriptionWord[];
  confidence: number;
  duration: number;
  paragraphs?: string[];
}

export interface Lecture {
  id: string;
  lectureNumber: number;
  title: string;
  summary: string;
  keyTopics: string[];
  audioFileIds: string[];
  fullTranscript: string;
  createdAt: string; // ISO string
}

export type PodcastFormat = "qa" | "narrative" | "discussion";

export interface PodcastScript {
  id: string;
  lectureId: string;
  format: PodcastFormat;
  title: string;
  description: string;
  script: string;
  generatedAt: string; // ISO string
}

export interface ProcessingStatus {
  totalFiles: number;
  transcribedFiles: number;
  lecturesGenerated: number;
  phase: "idle" | "uploading" | "transcribing" | "processing" | "complete" | "error";
  errorMessage?: string;
}
