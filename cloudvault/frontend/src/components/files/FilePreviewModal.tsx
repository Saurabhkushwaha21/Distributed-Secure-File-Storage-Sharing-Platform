import { useEffect, useState } from "react";
import { filesApi } from "@/services/filesApi";
import { FileItem } from "@/types";
import { formatBytes, formatDate } from "@/utils/format";
import { Button } from "@/components/ui/Button";

export function FilePreviewModal({ file, onClose }: { file: FileItem; onClose: () => void }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let currentUrl: string | null = null;
    setIsLoading(true);

    filesApi.downloadFile(file.id).then(async (res) => {
      const blob = res.data as Blob;
      if (file.mime_type.startsWith("text/")) {
        setTextContent(await blob.text());
      } else {
        currentUrl = URL.createObjectURL(blob);
        setObjectUrl(currentUrl);
      }
      setIsLoading(false);
    });

    return () => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [file.id, file.mime_type]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 px-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-md bg-white shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-steel-hairline px-5 py-3">
          <div>
            <h2 className="text-sm font-medium text-ink">{file.name}</h2>
            <p className="font-mono text-xs text-steel">
              {formatBytes(file.size_bytes)} · {file.mime_type} · updated {formatDate(file.updated_at)}
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1.5 text-steel hover:bg-paper hover:text-ink">
            ✕
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center overflow-auto bg-paper p-6">
          {isLoading && <p className="text-sm text-steel">Loading preview…</p>}

          {!isLoading && file.mime_type.startsWith("image/") && objectUrl && (
            <img src={objectUrl} alt={file.name} className="max-h-full max-w-full rounded" />
          )}

          {!isLoading && file.mime_type.startsWith("video/") && objectUrl && (
            <video src={objectUrl} controls className="max-h-full max-w-full rounded" />
          )}

          {!isLoading && file.mime_type.startsWith("audio/") && objectUrl && (
            <audio src={objectUrl} controls className="w-full max-w-md" />
          )}

          {!isLoading && file.mime_type === "application/pdf" && objectUrl && (
            <iframe src={objectUrl} title={file.name} className="h-[60vh] w-full rounded border border-steel-hairline" />
          )}

          {!isLoading && file.mime_type.startsWith("text/") && textContent !== null && (
            <pre className="max-h-[60vh] w-full overflow-auto whitespace-pre-wrap rounded border border-steel-hairline bg-white p-4 font-mono text-xs text-ink">
              {textContent}
            </pre>
          )}

          {!isLoading &&
            !file.mime_type.startsWith("image/") &&
            !file.mime_type.startsWith("video/") &&
            !file.mime_type.startsWith("audio/") &&
            !file.mime_type.startsWith("text/") &&
            file.mime_type !== "application/pdf" && (
              <p className="text-sm text-steel">No inline preview available for this file type.</p>
            )}
        </div>

        <div className="flex justify-end gap-2 border-t border-steel-hairline px-5 py-3">
          <Button
            variant="secondary"
            onClick={async () => {
              const res = await filesApi.downloadFile(file.id);
              const url = URL.createObjectURL(res.data);
              const a = document.createElement("a");
              a.href = url;
              a.download = file.name;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Download
          </Button>
        </div>
      </div>
    </div>
  );
}
