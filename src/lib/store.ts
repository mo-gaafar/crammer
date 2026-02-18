import { AudioFile, Transcription, Lecture, PodcastScript, ProcessingStatus } from "@/types";

interface StoreData {
  audioFiles: Map<string, AudioFile>;
  transcriptions: Map<string, Transcription>;
  lectures: Map<string, Lecture>;
  podcastScripts: Map<string, PodcastScript>;
  status: ProcessingStatus;
}

function createStore(): StoreData {
  return {
    audioFiles: new Map(),
    transcriptions: new Map(),
    lectures: new Map(),
    podcastScripts: new Map(),
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

export const store = {
  // Audio files
  addAudioFile(file: AudioFile): void {
    getStore().audioFiles.set(file.id, file);
  },
  getAudioFile(id: string): AudioFile | undefined {
    return getStore().audioFiles.get(id);
  },
  updateAudioFile(id: string, updates: Partial<AudioFile>): void {
    const store = getStore();
    const existing = store.audioFiles.get(id);
    if (existing) {
      store.audioFiles.set(id, { ...existing, ...updates });
    }
  },
  getAllAudioFiles(): AudioFile[] {
    return Array.from(getStore().audioFiles.values());
  },
  clearAudioFiles(): void {
    getStore().audioFiles.clear();
  },

  // Transcriptions
  addTranscription(t: Transcription): void {
    getStore().transcriptions.set(t.audioFileId, t);
  },
  getTranscription(audioFileId: string): Transcription | undefined {
    return getStore().transcriptions.get(audioFileId);
  },
  getAllTranscriptions(): Transcription[] {
    return Array.from(getStore().transcriptions.values());
  },
  clearTranscriptions(): void {
    getStore().transcriptions.clear();
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
