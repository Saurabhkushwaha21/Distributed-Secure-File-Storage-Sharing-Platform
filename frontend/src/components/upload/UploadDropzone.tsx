import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import clsx from "clsx";
import { useUploadController } from "@/hooks/useUploadController";

export function UploadDropzone({ folderId }: { folderId: string | null }) {
  const { startUpload } = useUploadController();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      acceptedFiles.forEach((file) => startUpload(file, folderId));
    },
    [startUpload, folderId]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <div
      {...getRootProps()}
      className={clsx(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-6 py-10 text-center transition-colors",
        isDragActive ? "border-brass bg-brass-soft/40" : "border-steel-hairline hover:border-steel-soft"
      )}
    >
      <input {...getInputProps()} />
      <UploadIcon />
      <p className="text-sm font-medium text-ink">
        {isDragActive ? "Drop to upload" : "Drag files here, or click to browse"}
      </p>
      <p className="text-xs text-steel">Supports files up to 10GB, resumable if your connection drops.</p>
    </div>
  );
}

function UploadIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path
        d="M14 18V6M14 6 9.5 10.5M14 6l4.5 4.5"
        stroke="#B8842E"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6 18v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" stroke="#8993A8" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
