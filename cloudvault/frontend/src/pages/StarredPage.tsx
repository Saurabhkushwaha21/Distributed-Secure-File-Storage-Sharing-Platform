import { EmptyState } from "@/components/ui/Primitives";

/**
 * Starring is modeled in the frontend's FileItem type but the CloudVault
 * backend delivered so far doesn't persist a starred flag or expose a
 * /files?starred=true filter - so this page is an honest placeholder
 * rather than a fake list. Wiring it up needs: an is_starred column on
 * the files table, a PATCH /files/{id}/star endpoint, and a starred=true
 * query param on GET /files/contents or /search/files.
 */
export default function StarredPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-xl text-ink">Starred</h1>
        <p className="text-sm text-steel">Files you've marked as important.</p>
      </div>
      <EmptyState
        title="Starring isn't wired up yet"
        description="This needs a small backend addition (an is_starred column + endpoint) that hasn't been built yet — see this page's source comment for the exact gap."
      />
    </div>
  );
}
