import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AudioFile,
  Transcription,
  Lecture,
  PodcastScript,
  ProcessingStatus,
  StudyMaterial,
  TextAudioArtifact,
} from "@/types";

// audio_files and transcriptions are backed by Supabase (RLS-scoped per user)
// when Supabase auth is configured; pass `null` for the single-secret
// (APP_SECRET_KEY) deployment mode, which keeps the in-memory fallback below.
// See docs/supabase-auth-plan.md.
type DbClient = SupabaseClient | null;

interface StoreData {
  audioFiles: Map<string, AudioFile>;
  transcriptions: Map<string, Transcription>;
  lectures: Map<string, Lecture>;
  podcastScripts: Map<string, PodcastScript>;
  studyMaterials: Map<string, StudyMaterial>;
  textAudioArtifacts: Map<string, TextAudioArtifact>;
  status: ProcessingStatus;
}

function createStore(): StoreData {
  return {
    audioFiles: new Map(),
    transcriptions: new Map(),
    lectures: new Map(),
    podcastScripts: new Map(),
    studyMaterials: new Map(),
    textAudioArtifacts: new Map(),
    status: {
      totalFiles: 0,
      transcribedFiles: 0,
      lecturesGenerated: 0,
      phase: "idle",
    },
  };
}

// Persist store across Next.js hot reloads in dev
declare global {
  // eslint-disable-next-line no-var
  var __crammerStore: StoreData | undefined;
}

function getStore(): StoreData {
  if (!global.__crammerStore) {
    global.__crammerStore = createStore();
  }
  return global.__crammerStore;
}

function rowToAudioFile(row: Record<string, unknown>): AudioFile {
  return {
    id: row.id as string,
    originalName: row.original_name as string,
    savedPath: row.storage_path as string,
    mimeType: row.mime_type as string,
    size: row.size as number,
    recordedAt: row.recorded_at as string,
    uploadedAt: row.uploaded_at as string,
    status: row.status as AudioFile["status"],
    errorMessage: (row.error_message as string | null) ?? undefined,
    extractedAudioPath: (row.extracted_audio_path as string | null) ?? undefined,
  };
}

function audioFileToRow(file: AudioFile, userId: string) {
  return {
    id: file.id,
    user_id: userId,
    original_name: file.originalName,
    storage_path: file.savedPath,
    mime_type: file.mimeType,
    size: file.size,
    recorded_at: file.recordedAt,
    uploaded_at: file.uploadedAt,
    status: file.status,
    error_message: file.errorMessage ?? null,
    extracted_audio_path: file.extractedAudioPath ?? null,
  };
}

function audioFileUpdatesToRow(updates: Partial<AudioFile>) {
  const has = (key: keyof AudioFile) => Object.prototype.hasOwnProperty.call(updates, key);
  const row: Record<string, unknown> = {};
  if (has("originalName")) row.original_name = updates.originalName;
  if (has("savedPath")) row.storage_path = updates.savedPath;
  if (has("mimeType")) row.mime_type = updates.mimeType;
  if (has("size")) row.size = updates.size;
  if (has("recordedAt")) row.recorded_at = updates.recordedAt;
  if (has("uploadedAt")) row.uploaded_at = updates.uploadedAt;
  if (has("status")) row.status = updates.status;
  // errorMessage/extractedAudioPath are explicitly set to `undefined` by callers to
  // clear them — use `hasOwnProperty` rather than `!== undefined` so that intent persists.
  if (has("errorMessage")) row.error_message = updates.errorMessage ?? null;
  if (has("extractedAudioPath")) row.extracted_audio_path = updates.extractedAudioPath ?? null;
  return row;
}

function rowToTranscription(row: Record<string, unknown>): Transcription {
  return {
    audioFileId: row.audio_file_id as string,
    text: row.text as string,
    words: (row.words as Transcription["words"]) ?? [],
    confidence: row.confidence as number,
    duration: row.duration as number,
    paragraphs: (row.paragraphs as string[] | null) ?? undefined,
  };
}

function transcriptionToRow(t: Transcription, userId: string) {
  return {
    audio_file_id: t.audioFileId,
    user_id: userId,
    text: t.text,
    words: t.words,
    confidence: t.confidence,
    duration: t.duration,
    paragraphs: t.paragraphs ?? null,
  };
}

async function requireUserId(supabase: SupabaseClient): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

export const store = {
  // Audio files
  async addAudioFile(supabase: DbClient, file: AudioFile): Promise<void> {
    if (!supabase) {
      getStore().audioFiles.set(file.id, file);
      return;
    }
    const userId = await requireUserId(supabase);
    const { error } = await supabase.from("audio_files").insert(audioFileToRow(file, userId));
    if (error) throw new Error(error.message);
  },
  async getAudioFile(supabase: DbClient, id: string): Promise<AudioFile | undefined> {
    if (!supabase) return getStore().audioFiles.get(id);
    const { data, error } = await supabase.from("audio_files").select("*").eq("id", id).maybeSingle();
    if (error || !data) return undefined;
    return rowToAudioFile(data);
  },
  async updateAudioFile(supabase: DbClient, id: string, updates: Partial<AudioFile>): Promise<void> {
    if (!supabase) {
      const store = getStore();
      const existing = store.audioFiles.get(id);
      if (existing) {
        store.audioFiles.set(id, { ...existing, ...updates });
      }
      return;
    }
    const row = audioFileUpdatesToRow(updates);
    if (Object.keys(row).length === 0) return;
    const { error } = await supabase.from("audio_files").update(row).eq("id", id);
    if (error) throw new Error(error.message);
  },
  async getAllAudioFiles(supabase: DbClient): Promise<AudioFile[]> {
    if (!supabase) return Array.from(getStore().audioFiles.values());
    const { data, error } = await supabase.from("audio_files").select("*").order("uploaded_at");
    if (error || !data) return [];
    return data.map(rowToAudioFile);
  },
  async clearAudioFiles(supabase: DbClient): Promise<void> {
    if (!supabase) {
      getStore().audioFiles.clear();
      return;
    }
    const userId = await requireUserId(supabase);
    const { error } = await supabase.from("audio_files").delete().eq("user_id", userId);
    if (error) throw new Error(error.message);
  },

  // Transcriptions
  async addTranscription(supabase: DbClient, t: Transcription): Promise<void> {
    if (!supabase) {
      getStore().transcriptions.set(t.audioFileId, t);
      return;
    }
    const userId = await requireUserId(supabase);
    const { error } = await supabase
      .from("transcriptions")
      .upsert(transcriptionToRow(t, userId), { onConflict: "audio_file_id" });
    if (error) throw new Error(error.message);
  },
  async getTranscription(supabase: DbClient, audioFileId: string): Promise<Transcription | undefined> {
    if (!supabase) return getStore().transcriptions.get(audioFileId);
    const { data, error } = await supabase
      .from("transcriptions")
      .select("*")
      .eq("audio_file_id", audioFileId)
      .maybeSingle();
    if (error || !data) return undefined;
    return rowToTranscription(data);
  },
  async getAllTranscriptions(supabase: DbClient): Promise<Transcription[]> {
    if (!supabase) return Array.from(getStore().transcriptions.values());
    const { data, error } = await supabase.from("transcriptions").select("*");
    if (error || !data) return [];
    return data.map(rowToTranscription);
  },
  async clearTranscriptions(supabase: DbClient): Promise<void> {
    if (!supabase) {
      getStore().transcriptions.clear();
      return;
    }
    const userId = await requireUserId(supabase);
    const { error } = await supabase.from("transcriptions").delete().eq("user_id", userId);
    if (error) throw new Error(error.message);
  },

  // Lectures
  addLecture(lecture: Lecture): void {
    getStore().lectures.set(lecture.id, lecture);
  },
  getLecture(id: string): Lecture | undefined {
    return getStore().lectures.get(id);
  },
  getAllLectures(): Lecture[] {
    return Array.from(getStore().lectures.values()).sort(
      (a, b) => a.lectureNumber - b.lectureNumber
    );
  },
  clearLectures(): void {
    getStore().lectures.clear();
  },

  // Podcast scripts
  addPodcastScript(script: PodcastScript): void {
    getStore().podcastScripts.set(script.id, script);
  },
  getPodcastScript(id: string): PodcastScript | undefined {
    return getStore().podcastScripts.get(id);
  },
  getPodcastScriptsForLecture(lectureId: string): PodcastScript[] {
    return Array.from(getStore().podcastScripts.values()).filter(
      (s) => s.lectureId === lectureId
    );
  },

  // Study materials
  addStudyMaterial(material: StudyMaterial): void {
    getStore().studyMaterials.set(material.id, material);
  },
  getStudyMaterial(id: string): StudyMaterial | undefined {
    return getStore().studyMaterials.get(id);
  },
  getStudyMaterialsForLecture(lectureId: string): StudyMaterial[] {
    return Array.from(getStore().studyMaterials.values())
      .filter((m) => m.lectureId === lectureId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
  getAllStudyMaterials(): StudyMaterial[] {
    return Array.from(getStore().studyMaterials.values()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  },

  // Text-to-audio artifacts
  addTextAudioArtifact(artifact: TextAudioArtifact): void {
    getStore().textAudioArtifacts.set(artifact.id, artifact);
  },
  getTextAudioArtifact(id: string): TextAudioArtifact | undefined {
    return getStore().textAudioArtifacts.get(id);
  },
  updateTextAudioArtifact(id: string, updates: Partial<TextAudioArtifact>): void {
    const store = getStore();
    const existing = store.textAudioArtifacts.get(id);
    if (existing) {
      store.textAudioArtifacts.set(id, { ...existing, ...updates });
    }
  },
  getAllTextAudioArtifacts(): TextAudioArtifact[] {
    return Array.from(getStore().textAudioArtifacts.values()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  },
  deleteTextAudioArtifact(id: string): void {
    getStore().textAudioArtifacts.delete(id);
  },

  // Status
  getStatus(): ProcessingStatus {
    return getStore().status;
  },
  updateStatus(updates: Partial<ProcessingStatus>): void {
    const store = getStore();
    store.status = { ...store.status, ...updates };
  },

  // Full reset
  reset(): void {
    global.__crammerStore = createStore();
  },
};
