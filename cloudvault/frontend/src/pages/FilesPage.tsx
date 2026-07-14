import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useFolderContents, useFileMutations, useFileSearch } from "@/hooks/useFiles";
import { UploadDropzone } from "@/components/upload/UploadDropzone";
import { Breadcrumb } from "@/components/files/Breadcrumb";
import { FileTypeIcon } from "@/components/files/FileTypeIcon";
import { FileActionsMenu } from "@/components/files/FileActionsMenu";
import { VersionHistoryModal } from "@/components/files/VersionHistoryModal";
import { FilePreviewModal } from "@/components/files/FilePreviewModal";
import { ShareModal } from "@/components/sharing/ShareModal";
import { Button } from "@/components/ui/Button";
import { Card, EmptyState, Skeleton } from "@/components/ui/Primitives";
import { FileItem, FolderItem } from "@/types";
import { formatBytes, formatDate } from "@/utils/format";

type SortKey = "name" | "size" | "date";
type ViewMode = "grid" | "list";

export default function FilesPage() {
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get("q") ?? "";

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<FolderItem[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [versionsFileId, setVersionsFileId] = useState<string | null>(null);
  const [shareFileId, setShareFileId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const isSearchMode = searchQuery.trim().length > 0;
  const { data: contents, isLoading } = useFolderContents(currentFolderId);
  const { data: searchResults, isLoading: isSearching } = useFileSearch(searchQuery);
  const { createFolder, renameFile, deleteFile, copyFile, downloadFile } = useFileMutations();

  const folders = isSearchMode ? [] : contents?.folders ?? [];
  const files = isSearchMode ? searchResults ?? [] : contents?.files ?? [];

  const sortedFiles = useMemo(() => {
    const arr = [...files];
    arr.sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "size") return b.size_bytes - a.size_bytes;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return arr;
  }, [files, sortKey]);

  function navigateToFolder(folderId: string | null) {
    if (folderId === null) {
      setFolderPath([]);
      setCurrentFolderId(null);
      return;
    }
    const idx = folderPath.findIndex((f) => f.id === folderId);
    if (idx >= 0) {
      setFolderPath(folderPath.slice(0, idx + 1));
    }
    setCurrentFolderId(folderId);
  }

  function openFolder(folder: FolderItem) {
    setFolderPath([...folderPath, folder]);
    setCurrentFolderId(folder.id);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl text-ink">{isSearchMode ? `Search: "${searchQuery}"` : "My Files"}</h1>
          {!isSearchMode && <Breadcrumb path={folderPath} onNavigate={navigateToFolder} />}
        </div>
        {!isSearchMode && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setNewFolderOpen(true)}>
              New folder
            </Button>
            <div className="flex overflow-hidden rounded border border-steel-hairline">
              <button
                onClick={() => setViewMode("grid")}
                className={`px-3 py-2 text-xs ${viewMode === "grid" ? "bg-brass text-white" : "bg-white text-steel"}`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-2 text-xs ${viewMode === "list" ? "bg-brass text-white" : "bg-white text-steel"}`}
              >
                List
              </button>
            </div>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded border border-steel-hairline bg-white px-2 py-2 text-xs text-steel"
            >
              <option value="date">Sort: Date</option>
              <option value="name">Sort: Name</option>
              <option value="size">Sort: Size</option>
            </select>
          </div>
        )}
      </div>

      {!isSearchMode && <UploadDropzone folderId={currentFolderId} />}

      {newFolderOpen && (
        <Card className="flex items-center gap-2 p-3">
          <input
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            className="flex-1 rounded border border-steel-hairline px-3 py-1.5 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newFolderName.trim()) {
                createFolder.mutate({ name: newFolderName.trim(), parentId: currentFolderId });
                setNewFolderName("");
                setNewFolderOpen(false);
              }
            }}
          />
          <Button
            size="sm"
            onClick={() => {
              if (newFolderName.trim()) {
                createFolder.mutate({ name: newFolderName.trim(), parentId: currentFolderId });
                setNewFolderName("");
                setNewFolderOpen(false);
              }
            }}
          >
            Create
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setNewFolderOpen(false)}>
            Cancel
          </Button>
        </Card>
      )}

      {(isLoading || isSearching) && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      )}

      {!isLoading && !isSearching && folders.length === 0 && sortedFiles.length === 0 && (
        <EmptyState
          title={isSearchMode ? "No matches" : "This folder is empty"}
          description={
            isSearchMode ? "Try a different name, type, or date range." : "Drag files above, or create a folder to get started."
          }
        />
      )}

      {!isLoading && !isSearching && (folders.length > 0 || sortedFiles.length > 0) && (
        <div>
          {folders.length > 0 && (
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onDoubleClick={() => openFolder(folder)}
                  onClick={() => openFolder(folder)}
                  className="flex flex-col items-center gap-2 rounded-md border border-steel-hairline bg-paper-raised p-4 text-center hover:border-steel-soft"
                >
                  <FolderIcon />
                  <span className="w-full truncate text-xs font-medium text-ink">{folder.name}</span>
                </button>
              ))}
            </div>
          )}

          {viewMode === "grid" ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {sortedFiles.map((file) => (
                <div
                  key={file.id}
                  onDoubleClick={() => setPreviewFile(file)}
                  className="group relative flex flex-col items-center gap-2 rounded-md border border-steel-hairline bg-paper-raised p-4 text-center hover:border-steel-soft"
                >
                  <div className="absolute right-1.5 top-1.5 opacity-0 group-hover:opacity-100">
                    <FileActionsMenu
                      actions={buildFileActions(file, {
                        setPreviewFile,
                        setVersionsFileId,
                        setShareFileId,
                        setRenamingId,
                        setRenameValue,
                        deleteFile,
                        copyFile,
                        downloadFile,
                        currentFolderId,
                      })}
                    />
                  </div>
                  <FileTypeIcon mimeType={file.mime_type} className="h-9 w-9" />
                  {renamingId === file.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => {
                        if (renameValue.trim()) renameFile.mutate({ fileId: file.id, newName: renameValue.trim() });
                        setRenamingId(null);
                      }}
                      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                      className="w-full rounded border border-brass px-1 text-center text-xs"
                    />
                  ) : (
                    <span className="w-full truncate text-xs font-medium text-ink">{file.name}</span>
                  )}
                  <span className="font-mono text-[11px] text-steel">{formatBytes(file.size_bytes)}</span>
                </div>
              ))}
            </div>
          ) : (
            <Card className="overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-steel-hairline bg-paper text-xs uppercase tracking-wide text-steel">
                  <tr>
                    <th className="px-4 py-2 font-medium">Name</th>
                    <th className="px-4 py-2 font-medium">Size</th>
                    <th className="px-4 py-2 font-medium">Modified</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {sortedFiles.map((file) => (
                    <tr
                      key={file.id}
                      onDoubleClick={() => setPreviewFile(file)}
                      className="cursor-pointer border-b border-steel-hairline last:border-0 hover:bg-paper"
                    >
                      <td className="flex items-center gap-2 px-4 py-2.5">
                        <FileTypeIcon mimeType={file.mime_type} className="h-4 w-4 shrink-0" />
                        {file.name}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-steel">{formatBytes(file.size_bytes)}</td>
                      <td className="px-4 py-2.5 text-xs text-steel">{formatDate(file.updated_at)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <FileActionsMenu
                          actions={buildFileActions(file, {
                            setPreviewFile,
                            setVersionsFileId,
                            setShareFileId,
                            setRenamingId,
                            setRenameValue,
                            deleteFile,
                            copyFile,
                            downloadFile,
                            currentFolderId,
                          })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {previewFile && <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
      {versionsFileId && <VersionHistoryModal fileId={versionsFileId} onClose={() => setVersionsFileId(null)} />}
      {shareFileId && <ShareModal fileId={shareFileId} onClose={() => setShareFileId(null)} />}
    </div>
  );
}

function buildFileActions(
  file: FileItem,
  ctx: {
    setPreviewFile: (f: FileItem) => void;
    setVersionsFileId: (id: string) => void;
    setShareFileId: (id: string) => void;
    setRenamingId: (id: string) => void;
    setRenameValue: (v: string) => void;
    deleteFile: { mutate: (id: string) => void };
    copyFile: { mutate: (args: { fileId: string; targetFolderId: string | null }) => void };
    downloadFile: { mutate: (args: { fileId: string; fileName: string }) => void };
    currentFolderId: string | null;
  }
) {
  return [
    { label: "Preview", onClick: () => ctx.setPreviewFile(file) },
    { label: "Download", onClick: () => ctx.downloadFile.mutate({ fileId: file.id, fileName: file.name }) },
    {
      label: "Rename",
      onClick: () => {
        ctx.setRenamingId(file.id);
        ctx.setRenameValue(file.name);
      },
    },
    { label: "Make a copy", onClick: () => ctx.copyFile.mutate({ fileId: file.id, targetFolderId: ctx.currentFolderId }) },
    { label: "Version history", onClick: () => ctx.setVersionsFileId(file.id) },
    { label: "Share", onClick: () => ctx.setShareFileId(file.id) },
    { label: "Delete", onClick: () => ctx.deleteFile.mutate(file.id), danger: true },
  ];
}

function FolderIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <path
        d="M5 10.5A2 2 0 0 1 7 8.5h6l2.5 3H29a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-16Z"
        fill="#F2E4C8"
        stroke="#B8842E"
        strokeWidth="1.4"
      />
    </svg>
  );
}
