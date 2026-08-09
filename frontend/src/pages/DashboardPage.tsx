import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { useDashboard, useQuota } from "@/hooks/useDashboard";
import { VaultDial } from "@/components/charts/VaultDial";
import { Card, Skeleton } from "@/components/ui/Primitives";
import { formatBytes } from "@/utils/format";
import { useAppSelector } from "@/hooks/redux";

const TYPE_COLORS = ["#B8842E", "#2F8F6C", "#4B5567", "#C1443C", "#8993A8", "#8F6620"];

export default function DashboardPage() {
  const user = useAppSelector((s) => s.auth.user);
  const { data: dashboard, isLoading } = useDashboard();
  const { data: quota } = useQuota();

  const typeData = dashboard
    ? Object.entries(dashboard.files_by_type).map(([type, count]) => ({ name: shortMime(type), value: count }))
    : [];

  // Illustrative recent-activity series derived from current totals — a
  // production build would source this from the storage_usage snapshot
  // table (see backend app/analytics/models.py) for real historical points.
  const activitySeries = [
    { day: "Mon", uploads: Math.round((dashboard?.upload_count ?? 0) * 0.1) },
    { day: "Tue", uploads: Math.round((dashboard?.upload_count ?? 0) * 0.18) },
    { day: "Wed", uploads: Math.round((dashboard?.upload_count ?? 0) * 0.12) },
    { day: "Thu", uploads: Math.round((dashboard?.upload_count ?? 0) * 0.22) },
    { day: "Fri", uploads: Math.round((dashboard?.upload_count ?? 0) * 0.15) },
    { day: "Sat", uploads: Math.round((dashboard?.upload_count ?? 0) * 0.08) },
    { day: "Sun", uploads: Math.round((dashboard?.upload_count ?? 0) * 0.15) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-xl text-ink">Welcome back{user ? `, ${user.full_name.split(" ")[0]}` : ""}</h1>
        <p className="text-sm text-steel">Here's what's happening in your vault.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="flex items-center gap-5 p-5">
          {quota ? (
            <VaultDial percent={quota.percent_used} tone={quota.percent_used > 85 ? "red" : "brass"} size={96} />
          ) : (
            <Skeleton className="h-24 w-24 rounded-full" />
          )}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-steel">Storage used</p>
            <p className="mt-1 font-mono text-lg text-ink">
              {quota ? formatBytes(quota.used_bytes) : "—"}
              <span className="text-steel"> / {quota ? formatBytes(quota.quota_bytes) : "—"}</span>
            </p>
            <p className="mt-1 text-xs text-steel">{quota ? formatBytes(quota.available_bytes) : "—"} remaining</p>
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-steel">Total files</p>
          <p className="mt-2 font-display text-3xl text-ink">{isLoading ? "—" : dashboard?.total_files}</p>
          <p className="mt-1 text-xs text-steel">across all folders</p>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-steel">Uploads / Downloads</p>
          <p className="mt-2 font-display text-3xl text-ink">
            {isLoading ? "—" : dashboard?.upload_count}
            <span className="text-lg text-steel"> / {isLoading ? "—" : dashboard?.download_count}</span>
          </p>
          <p className="mt-1 text-xs text-steel">all-time activity</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <p className="text-sm font-medium text-ink">Files by type</p>
          <div className="mt-3 h-64">
            {typeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={typeData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {typeData.map((_, i) => (
                      <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-steel">No files yet</div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-medium text-ink">Upload activity (illustrative weekly split)</p>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activitySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D7DCE5" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#4B5567" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#4B5567" }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="uploads" fill="#B8842E" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

function shortMime(mime: string): string {
  if (mime.includes("/")) return mime.split("/")[1].toUpperCase().slice(0, 12);
  return mime;
}
