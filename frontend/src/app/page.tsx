"use client";

import { useEffect, useState } from "react";
import { getDashboard } from "@/lib/api";
import { PLATFORM_COLORS, SENTIMENT_COLORS } from "@/lib/platform-colors";

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="card text-center py-12">
        <p className="text-red-400 mb-2">Failed to load dashboard</p>
        <p className="text-sm text-[var(--muted)]">{error}</p>
        <p className="text-sm text-[var(--muted)] mt-4">
          Make sure the backend is running on port 8015
        </p>
      </div>
    );
  }

  if (!data) {
    return <div className="text-[var(--muted)]">Loading dashboard...</div>;
  }

  const { sentiment_breakdown: sb } = data;
  const sentimentTotal = sb.positive + sb.negative + sb.neutral + sb.mixed || 1;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Posts" value={data.total_posts} />
        <StatCard label="Posts (24h)" value={data.posts_24h} />
        <StatCard label="Active Topics" value={data.active_topics} />
        <StatCard label="Entities" value={data.total_entities} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Sentiment breakdown */}
        <div className="card">
          <h3 className="text-sm font-medium text-[var(--muted)] mb-4">
            Sentiment (24h)
          </h3>
          <div className="space-y-3">
            {(["positive", "negative", "neutral", "mixed"] as const).map((key) => {
              const count = sb[key] || 0;
              const pct = ((count / sentimentTotal) * 100).toFixed(1);
              return (
                <div key={key} className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: SENTIMENT_COLORS[key] }}
                  />
                  <span className="text-sm capitalize w-20">{key}</span>
                  <div className="flex-1 h-2 bg-[var(--border)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: SENTIMENT_COLORS[key],
                      }}
                    />
                  </div>
                  <span className="text-sm text-[var(--muted)] w-16 text-right">
                    {count} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Platform breakdown */}
        <div className="card">
          <h3 className="text-sm font-medium text-[var(--muted)] mb-4">
            Platforms (24h)
          </h3>
          {data.platform_breakdown.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No data yet. Create a topic to start collecting.</p>
          ) : (
            <div className="space-y-3">
              {data.platform_breakdown.map((p: any) => (
                <div key={p.platform} className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor: PLATFORM_COLORS[p.platform] || "#6B7280",
                    }}
                  />
                  <span className="text-sm capitalize w-28">{p.platform}</span>
                  <span className="text-sm text-[var(--muted)]">
                    {p.count} posts
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent alerts */}
      {data.recent_alerts.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-medium text-[var(--muted)] mb-4">
            Recent Alerts
          </h3>
          <div className="space-y-2">
            {data.recent_alerts.map((alert: any) => (
              <div
                key={alert.id}
                className="flex items-center gap-3 text-sm p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg"
              >
                <span className="text-yellow-400">{alert.type}</span>
                <span className="text-[var(--muted)]">
                  {new Date(alert.triggered_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <div className="text-sm text-[var(--muted)]">{label}</div>
      <div className="text-3xl font-bold mt-1">{value.toLocaleString()}</div>
    </div>
  );
}
