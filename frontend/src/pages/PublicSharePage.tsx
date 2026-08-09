import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { sharingApi } from "@/services/sharingApi";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatBytes } from "@/utils/format";

interface PublicMeta {
  file_name: string;
  mime_type: string;
  size_bytes: number;
  permission: string;
}

export default function PublicSharePage() {
  const { token = "" } = useParams();
  const [meta, setMeta] = useState<PublicMeta | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    load();
  }, [token]);

  async function load(pw?: string) {
    setIsLoading(true);
    setError(null);
    try {
      const res = await sharingApi.viewPublic(token, pw);
      setMeta(res.data);
      setNeedsPassword(false);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        setNeedsPassword(true);
      } else if (err?.response?.status === 404) {
        setError("This link doesn't exist or has been revoked.");
      } else if (err?.response?.status === 410) {
        setError("This link has expired or hit its download limit.");
      } else {
        setError("Something went wrong loading this link.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    load(password);
  }

  async function handleDownload() {
    try {
      const res = await sharingApi.downloadPublic(token, password || undefined);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = meta?.file_name ?? "download";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Couldn't download this file.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="w-full max-w-sm rounded-md bg-white p-8 text-center shadow-panel">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full border-2 border-brass">
          <div className="h-2 w-2 rounded-full bg-brass" />
        </div>

        {isLoading && <p className="text-sm text-steel">Loading shared file…</p>}

        {!isLoading && error && <p className="rounded bg-signal-redSoft px-3 py-2 text-sm text-signal-red">{error}</p>}

        {!isLoading && needsPassword && !error && (
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3">
            <p className="text-sm text-steel">This file is password protected.</p>
            <Input type="password" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button type="submit">Unlock</Button>
          </form>
        )}

        {!isLoading && meta && !needsPassword && (
          <div className="flex flex-col gap-3">
            <h1 className="font-display text-lg text-ink">{meta.file_name}</h1>
            <p className="font-mono text-xs text-steel">
              {formatBytes(meta.size_bytes)} · {meta.mime_type}
            </p>
            {meta.permission === "VIEW" ? (
              <p className="text-sm text-steel">This link only allows viewing metadata, not downloading.</p>
            ) : (
              <Button onClick={handleDownload}>Download file</Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
