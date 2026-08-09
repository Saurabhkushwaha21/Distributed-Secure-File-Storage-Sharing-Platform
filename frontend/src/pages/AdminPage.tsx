import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/apiClient";
import { Card, Skeleton } from "@/components/ui/Primitives";
import { Button } from "@/components/ui/Button";
import { formatBytes, formatDate } from "@/utils/format";
import { useAppDispatch } from "@/hooks/redux";
import { showToast } from "@/store/toastSlice";

interface AdminUser {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  storage_used_bytes: number;
  storage_quota_bytes: number;
}

interface SystemStats {
  total_users: number;
  total_files: number;
  total_storage_bytes: number;
}

interface ActivityLogEntry {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  created_at: string;
}

export default function AdminPage() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => api.get<SystemStats>("/admin/stats").then((r) => r.data),
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => api.get<AdminUser[]>("/admin/users").then((r) => r.data),
  });

  const { data: logs } = useQuery({
    queryKey: ["admin", "logs"],
    queryFn: () => api.get<ActivityLogEntry[]>("/admin/activity-logs", { params: { limit: 25 } }).then((r) => r.data),
  });

  const deactivate = useMutation({
    mutationFn: (userId: string) => api.patch(`/admin/users/${userId}/deactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      dispatch(showToast("User deactivated.", "success"));
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-xl text-ink">Admin panel</h1>
        <p className="text-sm text-steel">System-wide user management, storage monitoring, and activity.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-steel">Total users</p>
          <p className="mt-2 font-display text-3xl text-ink">{statsLoading ? "—" : stats?.total_users}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-steel">Total files</p>
          <p className="mt-2 font-display text-3xl text-ink">{statsLoading ? "—" : stats?.total_files}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-steel">Total storage</p>
          <p className="mt-2 font-mono text-2xl text-ink">
            {statsLoading ? "—" : formatBytes(stats?.total_storage_bytes ?? 0)}
          </p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-steel-hairline px-5 py-3">
          <p className="text-sm font-medium text-ink">Users</p>
        </div>
        {usersLoading ? (
          <div className="p-5">
            <Skeleton className="h-32" />
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-paper text-xs uppercase tracking-wide text-steel">
              <tr>
                <th className="px-5 py-2 font-medium">Email</th>
                <th className="px-5 py-2 font-medium">Role</th>
                <th className="px-5 py-2 font-medium">Storage used</th>
                <th className="px-5 py-2 font-medium">Status</th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id} className="border-b border-steel-hairline last:border-0">
                  <td className="px-5 py-2.5">{u.email}</td>
                  <td className="px-5 py-2.5">
                    <span className="rounded-full bg-paper px-2 py-0.5 text-xs">{u.role}</span>
                  </td>
                  <td className="px-5 py-2.5 font-mono text-xs text-steel">
                    {formatBytes(u.storage_used_bytes)} / {formatBytes(u.storage_quota_bytes)}
                  </td>
                  <td className="px-5 py-2.5">
                    {u.is_active ? (
                      <span className="text-xs text-vault-green">Active</span>
                    ) : (
                      <span className="text-xs text-signal-red">Deactivated</span>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    {u.is_active && (
                      <Button size="sm" variant="ghost" onClick={() => deactivate.mutate(u.id)}>
                        Deactivate
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-steel-hairline px-5 py-3">
          <p className="text-sm font-medium text-ink">Recent activity</p>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {logs?.map((log) => (
            <div key={log.id} className="flex items-center justify-between border-b border-steel-hairline px-5 py-2.5 last:border-0">
              <p className="text-sm text-ink">
                <span className="font-medium">{log.action}</span> · {log.resource_type}
              </p>
              <p className="font-mono text-xs text-steel">{formatDate(log.created_at)}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
