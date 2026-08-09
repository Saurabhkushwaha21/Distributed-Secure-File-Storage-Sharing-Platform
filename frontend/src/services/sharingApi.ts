import { api } from "./apiClient";
import { ShareLink, SharePermission } from "@/types";

export const sharingApi = {
  createLink: (params: {
    file_id: string;
    permission: SharePermission;
    password?: string;
    expires_in_hours?: number;
    max_downloads?: number;
  }) => api.post<ShareLink>("/sharing/links", params),

  myLinks: () => api.get<ShareLink[]>("/sharing/links"),

  revokeLink: (linkId: string) => api.delete(`/sharing/links/${linkId}`),

  viewPublic: (token: string, password?: string) =>
    api.get(`/sharing/public/${token}`, { params: password ? { password } : {} }),

  downloadPublic: (token: string, password?: string) =>
    api.post(`/sharing/public/${token}/download`, { password }, { responseType: "blob" }),
};
