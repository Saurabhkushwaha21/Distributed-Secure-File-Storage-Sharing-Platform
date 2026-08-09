import { api } from "./apiClient";
import { FileItem, FileVersion, FolderItem } from "@/types";

export const filesApi = {
  listContents: (folderId: string | null) =>
    api.get<{ folders: FolderItem[]; files: FileItem[] }>("/files/contents", {
      params: folderId ? { folder_id: folderId } : {},
    }),

  createFolder: (name: string, parent_id: string | null) =>
    api.post<FolderItem>("/files/folders", { name, parent_id }),

  renameFile: (fileId: string, new_name: string) =>
    api.patch<FileItem>(`/files/${fileId}/rename`, { new_name }),

  moveFile: (fileId: string, target_folder_id: string | null) =>
    api.patch<FileItem>(`/files/${fileId}/move`, { target_folder_id }),

  copyFile: (fileId: string, target_folder_id: string | null) =>
    api.post<FileItem>(`/files/${fileId}/copy`, { target_folder_id }),

  deleteFile: (fileId: string) => api.delete(`/files/${fileId}`),

  listTrash: () => api.get<FileItem[]>("/files/trash"),

  restoreFile: (fileId: string) => api.post<FileItem>(`/files/${fileId}/restore`),

  permanentlyDeleteFile: (fileId: string) => api.delete(`/files/${fileId}/permanent`),

  downloadFile: (fileId: string) => api.get(`/files/${fileId}/download`, { responseType: "blob" }),

  listVersions: (fileId: string) => api.get<FileVersion[]>(`/files/${fileId}/versions`),

  restoreVersion: (fileId: string, versionId: string) =>
    api.post<FileItem>(`/files/${fileId}/versions/${versionId}/restore`),

  deleteVersion: (fileId: string, versionId: string) =>
    api.delete(`/files/${fileId}/versions/${versionId}`),

  compareVersions: (fileId: string, versionA: string, versionB: string) =>
    api.get(`/files/${fileId}/versions/compare`, { params: { version_a: versionA, version_b: versionB } }),

  search: (params: {
    q?: string;
    mime_type?: string;
    min_size_bytes?: number;
    max_size_bytes?: number;
    created_after?: string;
    created_before?: string;
  }) => api.get<FileItem[]>("/search/files", { params }),
};
