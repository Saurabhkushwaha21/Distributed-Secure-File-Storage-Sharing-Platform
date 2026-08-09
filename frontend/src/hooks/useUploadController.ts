import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { nanoid } from "@reduxjs/toolkit";
import { useAppDispatch } from "./redux";
import { enqueueUpload, setUploadStatus, updateUploadProgress } from "@/store/uploadSlice";
import { showToast } from "@/store/toastSlice";
import { ChunkedUploader } from "@/services/uploadManager";

/**
 * Owns the live ChunkedUploader instances (kept in a ref map, not Redux,
 * since class instances with in-flight XHRs aren't serializable) and keeps
 * Redux's uploadSlice in sync for the UploadDock UI to render from.
 */
export function useUploadController() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const uploaders = useRef(new Map<string, ChunkedUploader>());

  const startUpload = useCallback(
    (file: File, folderId: string | null) => {
      const id = nanoid();
      dispatch(
        enqueueUpload({
          id,
          file,
          fileName: file.name,
          totalBytes: file.size,
          uploadedBytes: 0,
          status: "queued",
          speedBytesPerSec: 0,
          etaSeconds: null,
          nextChunkIndex: 0,
        })
      );

      const uploader = new ChunkedUploader(file, folderId, (snapshot) => {
        if (snapshot.status === "uploading") {
          dispatch(
            updateUploadProgress({
              id,
              uploadedBytes: snapshot.uploadedBytes,
              speedBytesPerSec: snapshot.speedBytesPerSec,
              etaSeconds: snapshot.etaSeconds,
            })
          );
        } else {
          dispatch(setUploadStatus({ id, status: snapshot.status, error: snapshot.error }));
          if (snapshot.status === "completed") {
            dispatch(showToast(`${file.name} uploaded.`, "success"));
            queryClient.invalidateQueries({ queryKey: ["files"] });
          } else if (snapshot.status === "failed") {
            dispatch(showToast(`${file.name} failed to upload.`, "error"));
          }
        }
      });

      uploaders.current.set(id, uploader);
      dispatch(setUploadStatus({ id, status: "uploading" }));

      uploader.start().catch(() => {
        dispatch(setUploadStatus({ id, status: "failed", error: "Upload failed" }));
      });

      return id;
    },
    [dispatch, queryClient]
  );

  const pauseUpload = useCallback(
    (id: string) => {
      uploaders.current.get(id)?.pause();
    },
    []
  );

  const resumeUpload = useCallback(
    (id: string) => {
      const uploader = uploaders.current.get(id);
      if (!uploader) return;
      dispatch(setUploadStatus({ id, status: "uploading" }));
      uploader.resume().catch(() => dispatch(setUploadStatus({ id, status: "failed", error: "Resume failed" })));
    },
    [dispatch]
  );

  const cancelUpload = useCallback(
    (id: string) => {
      uploaders.current.get(id)?.cancel();
      uploaders.current.delete(id);
    },
    []
  );

  return { startUpload, pauseUpload, resumeUpload, cancelUpload };
}
