import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { filesApi } from "@/services/filesApi";
import { Button } from "@/components/ui/Button";
import { formatBytes } from "@/utils/format";
import { formatDate } from "@/utils/format";
import { useAppDispatch } from "@/hooks/redux";
import { showToast } from "@/store/toastSlice";

export function VersionHistoryModal({ fileId, onClose }: { fileId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();

  const { data: versions, isLoading } = useQuery({
    queryKey: ["files", fileId, "versions"],
    queryFn: () => filesApi.listVersions(fileId).then((r) => r.data),
  });

  const restore = useMutation({
    mutationFn: (versionId: string) => filesApi.restoreVersion(fileId, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
      dispatch(showToast("Version restored.", "success"));
    },
  });

  const remove = useMutation({
    mutationFn: (versionId: string) => filesApi.deleteVersion(fileId, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", fileId, "versions"] });
      dispatch(showToast("Version deleted.", "success"));
    },
    onError: () => dispatch(showToast("Can't delete the active version.", "error")),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4" onClick={onClose}>
      <div
        className="max-h-[70vh] w-full max-w-lg overflow-y-auto rounded-md bg-white p-6 shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg text-ink">Version history</h2>
        <p className="mt-1 text-sm text-steel">Every completed upload is kept as a distinct, restorable version.</p>

        <div className="mt-5 flex flex-col gap-3">
          {isLoading && <p className="text-sm text-steel">Loading versions…</p>}
          {versions?.map((v, i) => (
            <div key={v.id} className="flex items-center justify-between rounded border border-steel-hairline p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brass-soft font-mono text-xs text-brass-dark">
                  v{v.version_number}
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">
                    {i === 0 ? "Current version" : `Version ${v.version_number}`}
                  </p>
                  <p className="font-mono text-xs text-steel">
                    {formatBytes(v.size_bytes)} · {formatDate(v.created_at)}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                {i !== 0 && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => restore.mutate(v.id)}>
                      Restore
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove.mutate(v.id)}>
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
          {versions?.length === 0 && <p className="text-sm text-steel">No completed versions yet.</p>}
        </div>

        <Button variant="secondary" className="mt-6 w-full" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
