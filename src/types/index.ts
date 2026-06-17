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
  /** Path to extracted audio file when source was a video — cleaned up after transcription */
  extractedAudioPath?: string;
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

export type StudyTemplateCategory = "notes" | "review" | "assessment" | "reference";
export type StudyTemplateSource = "built-in" | "community" | "user-created" | "premium";
export type StudyMaterialType =
  | "notes"
  | "flashcards"
  | "quiz"
  | "glossary"
  | "podcast_script"
  | "study_guide"
  | "lecture_study_doc";

export interface StudyTemplate {
  id: string;
  name: string;
  description: string;
  category: StudyTemplateCategory;
  type: StudyMaterialType;
  source: StudyTemplateSource;
  exports: string[];
  prompt: string;
}

export interface StudyMaterial {
  id: string;
  lectureId?: string;
  /** Display name for standalone materials generated from pasted text (no lecture). */
  sourceName?: string;
  templateId: string;
  type: StudyMaterialType;
  title: string;
  description: string;
  contentMarkdown: string;
  contentJson?: unknown;
  provider: "gemini";
  model: string;
  createdAt: string;
  updatedAt: string;
}

export interface PodcastScript {
  id: string;
  lectureId: string;
  format: PodcastFormat;
  title: string;
  description: string;
  script: string;
  ttsCostEstimate?: TtsCostEstimate;
  generatedAt: string; // ISO string
}

export type TtsProvider = "gemini" | "deepgram";

export interface TtsCostEstimate {
  characterCount: number;
  wordCount: number;
  estimatedAudioMinutes: number;
  providers: Record<TtsProvider, {
    model: string;
    estimatedUsd: number;
    billingBasis: string;
  }>;
}

export interface TextAudioArtifact {
  id: string;
  sourceName: string;
  title: string;
  script: string;
  rawText?: string;
  ttsProvider?: TtsProvider;
  ttsCostEstimate?: TtsCostEstimate;
  audioPath?: string;
  audioFileName?: string;
  mimeType: "audio/wav";
  createdAt: string; // ISO string
  scriptStatus?: "pending" | "generating" | "ready" | "error";
  scriptError?: string;
  audioStatus?: "idle" | "queued" | "generating" | "complete" | "error";
  audioChunksDone?: number;
  audioChunksTotal?: number;
  audioError?: string;
}

export interface ProcessingStatus {
  totalFiles: number;
  transcribedFiles: number;
  lecturesGenerated: number;
  phase: "idle" | "uploading" | "transcribing" | "processing" | "complete" | "error";
  errorMessage?: string;
}
