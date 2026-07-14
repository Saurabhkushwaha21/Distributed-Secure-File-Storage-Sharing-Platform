import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sharingApi } from "@/services/sharingApi";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SharePermission } from "@/types";
import { useAppDispatch } from "@/hooks/redux";
import { showToast } from "@/store/toastSlice";

export function ShareModal({ fileId, onClose }: { fileId: string; onClose: () => void }) {
  const [permission, setPermission] = useState<SharePermission>("VIEW");
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [expiresInHours, setExpiresInHours] = useState<number | "">("");
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  const { data: links } = useQuery({
    queryKey: ["sharing", "links"],
    queryFn: () => sharingApi.myLinks().then((r) => r.data.filter((l) => l.file_id === fileId)),
  });

  const createLink = useMutation({
    mutationFn: () =>
      sharingApi.createLink({
        file_id: fileId,
        permission,
        password: usePassword ? password : undefined,
        expires_in_hours: expiresInHours === "" ? undefined : Number(expiresInHours),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sharing", "links"] });
      dispatch(showToast("Share link created.", "success"));
    },
  });

  const revokeLink = useMutation({
    mutationFn: (linkId: string) => sharingApi.revokeLink(linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sharing", "links"] });
      dispatch(showToast("Link revoked.", "success"));
    },
  });

  function shareUrl(token: string) {
    return `${window.location.origin}/s/${token}`;
  }

  async function copyLink(token: string) {
    await navigator.clipboard.writeText(shareUrl(token));
    dispatch(showToast("Link copied to clipboard.", "info"));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-md bg-white p-6 shadow-panel" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-lg text-ink">Share file</h2>
        <p className="mt-1 text-sm text-steel">Anyone with the link can access it per the permission you set.</p>

        <div className="mt-5 flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-steel">Permission</label>
            <div className="mt-1.5 flex gap-2">
              {(["VIEW", "DOWNLOAD", "EDIT"] as SharePermission[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPermission(p)}
                  className={`rounded px-3 py-1.5 text-xs font-medium border ${
                    permission === p
                      ? "border-brass bg-brass-soft text-brass-dark"
                      : "border-steel-hairline text-steel hover:bg-paper"
                  }`}
                >
                  {p === "VIEW" ? "View only" : p === "DOWNLOAD" ? "Can download" : "Can edit"}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-steel">
            <input
              type="checkbox"
              checked={usePassword}
              onChange={(e) => setUsePassword(e.target.checked)}
              className="rounded border-steel-hairline text-brass"
            />
            Password protect this link
          </label>
          {usePassword && (
            <Input placeholder="Set a password" value={password} onChange={(e) => setPassword(e.target.value)} />
          )}

          <Input
            label="Expires in (hours, optional)"
            type="number"
            min={1}
            value={expiresInHours}
            onChange={(e) => setExpiresInHours(e.target.value === "" ? "" : Number(e.target.value))}
          />

          <Button onClick={() => createLink.mutate()} isLoading={createLink.isPending}>
            Create share link
          </Button>
        </div>

        {links && links.length > 0 && (
          <div className="mt-6 border-t border-steel-hairline pt-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-steel">Active links</h3>
            <div className="mt-2 flex flex-col gap-2">
              {links.map((link) => (
                <div key={link.id} className="flex items-center justify-between rounded border border-steel-hairline p-2">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-ink">{shareUrl(link.token)}</p>
                    <p className="text-[11px] text-steel">
                      {link.permission} · {link.download_count} download{link.download_count === 1 ? "" : "s"}
                      {link.is_password_protected && " · password protected"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="ghost" onClick={() => copyLink(link.token)}>
                      Copy
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => revokeLink.mutate(link.id)}>
                      Revoke
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button variant="secondary" className="mt-6 w-full" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
