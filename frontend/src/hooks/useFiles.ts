import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { filesApi } from "@/services/filesApi";
import { useAppDispatch } from "./redux";
import { showToast } from "@/store/toastSlice";
import { getErrorMessage } from "@/utils/errors";

export function useFolderContents(folderId: string | null) {
  return useQuery({
    queryKey: ["files", "contents", folderId],
    queryFn: () => filesApi.listContents(folderId).then((r) => r.data),
  });
}

export function useFileSearch(query: string) {
  return useQuery({
    queryKey: ["files", "search", query],
    queryFn: () => filesApi.search({ q: query }).then((r) => r.data),
    enabled: query.trim().length > 0,
  });
}

export function useTrash() {
  return useQuery({
    queryKey: ["files", "trash"],
    queryFn: () => filesApi.listTrash().then((r) => r.data),
  });
}

export function useTrashMutations() {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();

  // Restoring/purging a file also affects the normal folder listing (it
  // reappears/disappears there) and the user's quota shown elsewhere, so
  // invalidate both "files" and "trash" query groups rather than just trash.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["files"] });
  };

  const restoreFile = useMutation({
    mutationFn: (fileId: string) => filesApi.restoreFile(fileId),
    onSuccess: () => {
      invalidate();
      dispatch(showToast("File restored.", "success"));
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { status?: number } })?.response?.status === 507
          ? "Not enough storage quota to restore this file."
          : getErrorMessage(err, "Restore failed.");
      dispatch(showToast(message, "error"));
    },
  });

  const permanentlyDeleteFile = useMutation({
    mutationFn: (fileId: string) => filesApi.permanentlyDeleteFile(fileId),
    onSuccess: () => {
      invalidate();
      dispatch(showToast("File permanently deleted.", "success"));
    },
    onError: (err: unknown) => dispatch(showToast(getErrorMessage(err, "Delete failed."), "error")),
  });

  return { restoreFile, permanentlyDeleteFile };
}

export function useFileMutations() {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["files"] });

  const createFolder = useMutation({
    mutationFn: ({ name, parentId }: { name: string; parentId: string | null }) =>
      filesApi.createFolder(name, parentId),
    onSuccess: () => {
      invalidate();
      dispatch(showToast("Folder created.", "success"));
    },
    onError: (err: unknown) => dispatch(showToast(getErrorMessage(err, "Couldn't create folder."), "error")),
  });

  const renameFile = useMutation({
    mutationFn: ({ fileId, newName }: { fileId: string; newName: string }) => filesApi.renameFile(fileId, newName),
    onSuccess: () => {
      invalidate();
      dispatch(showToast("Renamed.", "success"));
    },
    onError: (err: unknown) => dispatch(showToast(getErrorMessage(err, "Rename failed."), "error")),
  });

  const moveFile = useMutation({
    mutationFn: ({ fileId, targetFolderId }: { fileId: string; targetFolderId: string | null }) =>
      filesApi.moveFile(fileId, targetFolderId),
    onSuccess: () => {
      invalidate();
      dispatch(showToast("Moved.", "success"));
    },
    onError: (err: unknown) => dispatch(showToast(getErrorMessage(err, "Move failed."), "error")),
  });

  const copyFile = useMutation({
    mutationFn: ({ fileId, targetFolderId }: { fileId: string; targetFolderId: string | null }) =>
      filesApi.copyFile(fileId, targetFolderId),
    onSuccess: () => {
      invalidate();
      dispatch(showToast("Copy created.", "success"));
    },
    onError: (err: unknown) => dispatch(showToast(getErrorMessage(err, "Couldn't create a copy."), "error")),
  });

  const deleteFile = useMutation({
    mutationFn: (fileId: string) => filesApi.deleteFile(fileId),
    onSuccess: () => {
      invalidate();
      dispatch(showToast("Moved to trash.", "success"));
    },
    onError: (err: unknown) => dispatch(showToast(getErrorMessage(err, "Delete failed."), "error")),
  });

  const downloadFile = useMutation({
    mutationFn: async ({ fileId, fileName }: { fileId: string; fileName: string }) => {
      const res = await filesApi.downloadFile(fileId);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (err: unknown) => dispatch(showToast(getErrorMessage(err, "Download failed."), "error")),
  });

  return { createFolder, renameFile, moveFile, copyFile, deleteFile, downloadFile };
}
