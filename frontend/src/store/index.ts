import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import toastReducer from "./toastSlice";
import uploadReducer from "./uploadSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    toasts: toastReducer,
    uploads: uploadReducer,
  },
  middleware: (getDefault) =>
    getDefault({
      serializableCheck: {
        // UploadTask carries a raw File object, which is not plain-serializable
        // but is intentionally kept in Redux for single-source-of-truth queue state.
        ignoredActions: ["uploads/enqueueUpload"],
        ignoredPaths: ["uploads"],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
