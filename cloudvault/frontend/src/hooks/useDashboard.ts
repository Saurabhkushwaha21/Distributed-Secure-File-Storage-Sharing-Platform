import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/apiClient";

interface DashboardData {
  total_files: number;
  total_storage_bytes: number;
  files_by_type: Record<string, number>;
  upload_count: number;
  download_count: number;
}

interface QuotaData {
  quota_bytes: number;
  used_bytes: number;
  available_bytes: number;
  percent_used: number;
}

export function useDashboard() {
  return useQuery({
    queryKey: ["analytics", "dashboard"],
    queryFn: () => api.get<DashboardData>("/analytics/dashboard").then((r) => r.data),
  });
}

export function useQuota() {
  return useQuery({
    queryKey: ["users", "quota"],
    queryFn: () => api.get<QuotaData>("/users/me/quota").then((r) => r.data),
  });
}
