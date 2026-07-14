export type UserRole = "USER" | "ADMIN";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_email_verified: boolean;
  storage_quota_bytes: number;
  storage_used_bytes: number;
  created_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface FolderItem {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

export interface FileItem {
  id: string;
  name: string;
  folder_id: string | null;
  mime_type: string;
  size_bytes: number;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
  starred?: boolean;
  is_duplicate?: boolean;
  duplicate_of_file_id?: string | null;
}

export interface FileVersion {
  id: string;
  version_number: number;
  size_bytes: number;
  upload_status: "PENDING" | "UPLOADING" | "COMPLETED" | "FAILED";
  created_at: string;
}

export type SharePermission = "VIEW" | "DOWNLOAD" | "EDIT";

export interface ShareLink {
  id: string;
  token: string;
  file_id: string;
  permission: SharePermission;
  is_password_protected: boolean;
  expires_at: string | null;
  max_downloads: number | null;
  download_count: number;
  created_at: string;
}

export type UploadStatus =
  | "queued"
  | "uploading"
  | "paused"
  | "completed"
  | "failed"
  | "canceled";

export interface UploadTask {
  id: string; // client-generated local id
  file: File;
  fileName: string;
  totalBytes: number;
  uploadedBytes: number;
  status: UploadStatus;
  speedBytesPerSec: number;
  etaSeconds: number | null;
  error?: string;
  versionId?: string;
  totalChunks?: number;
  nextChunkIndex: number;
}

export interface RealtimeEvent {
  event:
    | "upload_started"
    | "upload_progress"
    | "upload_completed"
    | "file_processed"
    | "security_alert";
  data: Record<string, unknown>;
}
