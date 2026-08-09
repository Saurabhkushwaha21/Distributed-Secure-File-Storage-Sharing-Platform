import { useState } from "react";
import { useTrash, useTrashMutations } from "@/hooks/useFiles";
import { FileTypeIcon } from "@/components/files/FileTypeIcon";
import { FileActionsMenu } from "@/components/files/FileActionsMenu";
import { Card, EmptyState, Skeleton } from "@/components/ui/Primitives";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatBytes, formatDate } from "@/utils/format";

export default function TrashPage() {
  const { data: files, isLoading } = useTrash();
  const { restoreFile, permanentlyDeleteFile } = useTrashMutations();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const confirmDeleteName = files?.find((f) => f.id === confirmDeleteId)?.name;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-xl text-ink">Trash</h1>
        <p className="text-sm text-steel">
          Deleted files stay recoverable here for a limited time before they're permanently purged.
        </p>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      )}

      {!isLoading && (files?.length ?? 0) === 0 && (
        <EmptyState title="Trash is empty" description="Files you delete will show up here until they're restored or purged." />
      )}

      {!isLoading && (files?.length ?? 0) > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-steel-hairline bg-paper text-xs uppercase tracking-wide text-steel">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Size</th>
                <th className="px-4 py-2 font-medium">Deleted</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {files!.map((file) => (
                <tr key={file.id} className="border-b border-steel-hairline last:border-0 hover:bg-paper">
                  <td className="flex items-center gap-2 px-4 py-2.5">
                    <FileTypeIcon mimeType={file.mime_type} className="h-4 w-4 shrink-0" />
                    <span className="text-steel">{file.name}</span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-steel">{formatBytes(file.size_bytes)}</td>
                  <td className="px-4 py-2.5 text-xs text-steel">{formatDate(file.updated_at)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <FileActionsMenu
                      actions={[
                        { label: "Restore", onClick: () => restoreFile.mutate(file.id) },
                        { label: "Delete forever", onClick: () => setConfirmDeleteId(file.id), danger: true },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Delete forever?"
        description={`"${confirmDeleteName}" will be permanently deleted. This can't be undone.`}
        confirmLabel="Delete forever"
        danger
        onConfirm={() => {
          if (confirmDeleteId) permanentlyDeleteFile.mutate(confirmDeleteId);
          setConfirmDeleteId(null);
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
