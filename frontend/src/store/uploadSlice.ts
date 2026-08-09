import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { UploadTask, UploadStatus } from "@/types";

const uploadSlice = createSlice({
  name: "uploads",
  initialState: [] as UploadTask[],
  reducers: {
    enqueueUpload(state, action: PayloadAction<UploadTask>) {
      state.push(action.payload);
    },
    updateUploadProgress(
      state,
      action: PayloadAction<{
        id: string;
        uploadedBytes: number;
        speedBytesPerSec: number;
        etaSeconds: number | null;
      }>
    ) {
      const task = state.find((t) => t.id === action.payload.id);
      if (task) {
        task.uploadedBytes = action.payload.uploadedBytes;
        task.speedBytesPerSec = action.payload.speedBytesPerSec;
        task.etaSeconds = action.payload.etaSeconds;
        task.status = "uploading";
      }
    },
    setUploadStatus(state, action: PayloadAction<{ id: string; status: UploadStatus; error?: string }>) {
      const task = state.find((t) => t.id === action.payload.id);
      if (task) {
        task.status = action.payload.status;
        task.error = action.payload.error;
      }
    },
    removeUpload(state, action: PayloadAction<string>) {
      return state.filter((t) => t.id !== action.payload);
    },
    clearCompleted(state) {
      return state.filter((t) => t.status !== "completed");
    },
  },
});

export const { enqueueUpload, updateUploadProgress, setUploadStatus, removeUpload, clearCompleted } =
  uploadSlice.actions;
export default uploadSlice.reducer;
