import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useDashboard } from "@/hooks/useDashboard";
import { Card } from "@/components/ui/Primitives";
import { formatBytes } from "@/utils/format";

const COLORS = ["#B8842E", "#2F8F6C", "#4B5567", "#C1443C", "#8993A8", "#8F6620"];

export default function AnalyticsPage() {
  const { data: dashboard } = useDashboard();

  const typeData = dashboard
    ? Object.entries(dashboard.files_by_type).map(([type, count]) => ({ name: type, count }))
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-xl text-ink">Storage analytics</h1>
        <p className="text-sm text-steel">
          Consumption, category breakdown, and activity across your vault.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-steel">Total storage consumed</p>
          <p className="mt-2 font-mono text-2xl text-ink">{formatBytes(dashboard?.total_storage_bytes ?? 0)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-steel">Total uploads</p>
          <p className="mt-2 font-mono text-2xl text-ink">{dashboard?.upload_count ?? 0}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-steel">Total downloads</p>
          <p className="mt-2 font-mono text-2xl text-ink">{dashboard?.download_count ?? 0}</p>
        </Card>
      </div>

      <Card className="p-5">
        <p className="text-sm font-medium text-ink">File count by MIME type</p>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={typeData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#D7DCE5" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12, fill: "#4B5567" }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11, fill: "#4B5567" }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                {typeData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-5">
        <p className="text-sm font-medium text-ink">Share of storage by type</p>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={typeData} dataKey="count" nameKey="name" outerRadius={100} label>
                {typeData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
