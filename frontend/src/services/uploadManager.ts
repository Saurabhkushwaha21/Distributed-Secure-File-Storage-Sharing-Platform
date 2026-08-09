import axios, { CancelTokenSource } from "axios";
import { api } from "./apiClient";

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB, matches backend default
const MAX_PARALLEL_CHUNKS = 4;
const MAX_RETRIES_PER_CHUNK = 3;

export interface UploadProgressSnapshot {
  uploadedBytes: number;
  totalBytes: number;
  speedBytesPerSec: number;
  etaSeconds: number | null;
  status: "uploading" | "paused" | "completed" | "failed" | "canceled";
  error?: string;
}

type ProgressCallback = (snapshot: UploadProgressSnapshot) => void;

/**
 * Drives CloudVault's chunked upload API end to end:
 *   POST /files/upload/init -> many POST /files/upload/chunk (parallel) -> POST /files/upload/complete
 *
 * Handles pause/resume (by tracking which chunk indices have been
 * acknowledged and re-querying /upload/{id}/missing-chunks on resume so a
 * page refresh mid-upload can still recover), cancellation (aborts
 * in-flight requests via axios CancelToken), and per-chunk retry with
 * capped attempts before failing the whole upload.
 */
export class ChunkedUploader {
  private file: File;
  private folderId: string | null;
  private chunkSize: number;
  private onProgress: ProgressCallback;

  private versionId: string | null = null;
  private fileId: string | null = null;
  private totalChunks = 0;
  private completedChunkIndices = new Set<number>();
  private inFlightSources = new Map<number, CancelTokenSource>();

  private uploadedBytes = 0;
  private lastTickTime = 0;
  private lastTickBytes = 0;

  private isPaused = false;
  private isCanceled = false;

  constructor(file: File, folderId: string | null, onProgress: ProgressCallback, chunkSize = DEFAULT_CHUNK_SIZE) {
    this.file = file;
    this.folderId = folderId;
    this.chunkSize = chunkSize;
    this.onProgress = onProgress;
  }

  async start(): Promise<{ fileId: string }> {
    const initRes = await api.post("/files/upload/init", {
      file_name: this.file.name,
      folder_id: this.folderId,
      total_size_bytes: this.file.size,
      mime_type: this.file.type || "application/octet-stream",
      chunk_size_bytes: this.chunkSize,
    });

    this.fileId = initRes.data.file_id;
    this.versionId = initRes.data.version_id;
    this.totalChunks = initRes.data.total_chunks;
    this.lastTickTime = performance.now();

    await this.uploadRemainingChunks();
    return { fileId: this.fileId! };
  }

  async resume(): Promise<void> {
    if (!this.versionId) throw new Error("Cannot resume: upload was never started");
    this.isPaused = false;
    this.isCanceled = false;

    // Re-sync with the server in case of a page refresh: ask which chunks
    // are still missing instead of trusting only local state.
    const missing = await api.get(`/files/upload/${this.versionId}/missing-chunks`);
    const missingSet = new Set<number>(missing.data.missing_chunk_indices);
    this.completedChunkIndices = new Set(
      Array.from({ length: this.totalChunks }, (_, i) => i).filter((i) => !missingSet.has(i))
    );

    this.lastTickTime = performance.now();
    this.lastTickBytes = this.uploadedBytes;
    await this.uploadRemainingChunks();
  }

  pause(): void {
    this.isPaused = true;
    this.inFlightSources.forEach((source) => source.cancel("paused"));
    this.inFlightSources.clear();
    this.emit("paused");
  }

  cancel(): void {
    this.isCanceled = true;
    this.inFlightSources.forEach((source) => source.cancel("canceled"));
    this.inFlightSources.clear();
    this.emit("canceled");
  }

  private async uploadRemainingChunks(): Promise<void> {
    const pending = Array.from({ length: this.totalChunks }, (_, i) => i).filter(
      (i) => !this.completedChunkIndices.has(i)
    );

    let cursor = 0;
    const workers: Promise<void>[] = [];

    const runNext = async (): Promise<void> => {
      while (cursor < pending.length) {
        if (this.isPaused || this.isCanceled) return;
        const chunkIndex = pending[cursor++];
        await this.uploadChunkWithRetry(chunkIndex);
        if (this.isPaused || this.isCanceled) return;
      }
    };

    for (let w = 0; w < Math.min(MAX_PARALLEL_CHUNKS, pending.length); w++) {
      workers.push(runNext());
    }
    await Promise.all(workers);

    if (this.isCanceled) return;
    if (this.isPaused) return;

    if (this.completedChunkIndices.size === this.totalChunks) {
      await this.completeUpload();
    }
  }

  private async uploadChunkWithRetry(chunkIndex: number, attempt = 1): Promise<void> {
    const start = chunkIndex * this.chunkSize;
    const end = Math.min(start + this.chunkSize, this.file.size);
    const blob = this.file.slice(start, end);

    const source = axios.CancelToken.source();
    this.inFlightSources.set(chunkIndex, source);

    const formData = new FormData();
    formData.append("chunk", blob);

    let bytesSentForThisChunkBefore = 0;

    try {
      await api.post("/files/upload/chunk", formData, {
        params: { version_id: this.versionId, chunk_index: chunkIndex },
        headers: { "Content-Type": "multipart/form-data" },
        cancelToken: source.token,
        onUploadProgress: (evt) => {
          const delta = (evt.loaded ?? 0) - bytesSentForThisChunkBefore;
          bytesSentForThisChunkBefore = evt.loaded ?? 0;
          this.uploadedBytes += delta;
          this.tick();
        },
      });

      this.inFlightSources.delete(chunkIndex);
      this.completedChunkIndices.add(chunkIndex);
    } catch (err) {
      this.inFlightSources.delete(chunkIndex);
      if (axios.isCancel(err)) return; // paused/canceled intentionally

      if (attempt < MAX_RETRIES_PER_CHUNK) {
        const backoffMs = 500 * 2 ** (attempt - 1);
        await new Promise((r) => setTimeout(r, backoffMs));
        return this.uploadChunkWithRetry(chunkIndex, attempt + 1);
      }

      this.emit("failed", `Chunk ${chunkIndex} failed after ${MAX_RETRIES_PER_CHUNK} attempts`);
      throw err;
    }
  }

  private async completeUpload(): Promise<void> {
    await api.post("/files/upload/complete", { version_id: this.versionId });
    this.emit("completed");
  }

  private tick(): void {
    const now = performance.now();
    const elapsedSec = (now - this.lastTickTime) / 1000;

    if (elapsedSec >= 0.25) {
      const bytesSinceLastTick = this.uploadedBytes - this.lastTickBytes;
      const speed = bytesSinceLastTick / elapsedSec;
      const remaining = this.file.size - this.uploadedBytes;
      const eta = speed > 0 ? remaining / speed : null;

      this.lastTickTime = now;
      this.lastTickBytes = this.uploadedBytes;

      this.emit("uploading", undefined, speed, eta);
    }
  }

  private emit(
    status: UploadProgressSnapshot["status"],
    error?: string,
    speedBytesPerSec = 0,
    etaSeconds: number | null = null
  ): void {
    this.onProgress({
      uploadedBytes: this.uploadedBytes,
      totalBytes: this.file.size,
      speedBytesPerSec,
      etaSeconds,
      status,
      error,
    });
  }
}
