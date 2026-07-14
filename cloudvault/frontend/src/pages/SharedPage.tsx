import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sharingApi } from "@/services/sharingApi";
import { Card, EmptyState } from "@/components/ui/Primitives";
import { Button } from "@/components/ui/Button";
import { useAppDispatch } from "@/hooks/redux";
import { showToast } from "@/store/toastSlice";

export default function SharedPage() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  const { data: links, isLoading } = useQuery({
    queryKey: ["sharing", "links"],
    queryFn: () => sharingApi.myLinks().then((r) => r.data),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => sharingApi.revokeLink(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sharing", "links"] });
      dispatch(showToast("Link revoked.", "success"));
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-xl text-ink">Shared by you</h1>
        <p className="text-sm text-steel">
          Every active share link you've created, across all files. Create new links from a file's ⋯ menu in My Files.
        </p>
      </div>

      {!isLoading && (!links || links.length === 0) && (
        <EmptyState title="Nothing shared yet" description="Share a file from My Files to see its link here." />
      )}

      {links && links.length > 0 && (
        <Card className="divide-y divide-steel-hairline">
          {links.map((link) => (
            <div key={link.id} className="flex items-center justify-between p-4">
              <div className="min-w-0">
                <p className="truncate font-mono text-xs text-ink">{`${window.location.origin}/s/${link.token}`}</p>
                <p className="mt-0.5 text-xs text-steel">
                  {link.permission} · {link.download_count} download{link.download_count === 1 ? "" : "s"}
                  {link.expires_at && ` · expires ${new Date(link.expires_at).toLocaleDateString()}`}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => revoke.mutate(link.id)}>
                Revoke
              </Button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
