"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getDashboard, getTopics, getTopicPosts } from "@/lib/api";
import { PLATFORM_COLORS, SENTIMENT_COLORS } from "@/lib/platform-colors";

export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [topics, setTopics] = useState<any[]>([]);
  const [recentPosts, setRecentPosts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboard().then(setData).catch((e) => setError(e.message));
    getTopics().then(async (topics) => {
      setTopics(topics);
      if (topics.length > 0) {
        const feed = await getTopicPosts(topics[0].id, { page_size: "8" });
        setRecentPosts(feed.posts || []);
      }
    }).catch(console.error);
  }, []);

  if (error) {
    return (
      <div className="card text-center py-12">
        <p className="text-red-400 mb-2">Failed to load dashboard</p>
        <p className="text-sm text-[var(--muted)]">{error}</p>
      </div>
    );
  }

  if (!data) return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-[var(--border)] rounded animate-pulse" />
      <div className="grid grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="card animate-pulse">
            <div className="h-3 w-20 bg-[var(--border)] rounded mb-3" />
            <div className="h-8 w-16 bg-[var(--border)] rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card animate-pulse">
            <div className="h-3 w-24 bg-[var(--border)] rounded mb-4" />
            <div className="space-y-3">
              <div className="h-3 bg-[var(--border)] rounded" />
              <div className="h-3 bg-[var(--border)] rounded" />
              <div className="h-3 bg-[var(--border)] rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const { sentiment_breakdown: sb } = data;
  const sentimentTotal = sb.positive + sb.negative + sb.neutral + sb.mixed || 1;
  const sentimentScore = sentimentTotal > 0
    ? ((sb.positive - sb.negative) / sentimentTotal * 100).toFixed(0)
    : "0";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="text-xs text-[var(--muted)]">
          Auto-collecting every 15 min | Last update: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-5 gap-4">
        <StatCard label="Total Posts" value={data.total_posts} />
        <StatCard label="Posts (24h)" value={data.posts_24h} />
        <StatCard label="Active Topics" value={data.active_topics} />
        <StatCard label="Meme Templates" value={113} />
        <div className="card">
          <div className="text-sm text-[var(--muted)]">Net Sentiment</div>
          <div className="text-3xl font-bold mt-1" style={{
            color: Number(sentimentScore) > 10 ? SENTIMENT_COLORS.positive
              : Number(sentimentScore) < -10 ? SENTIMENT_COLORS.negative
              : SENTIMENT_COLORS.neutral
          }}>
            {Number(sentimentScore) > 0 ? "+" : ""}{sentimentScore}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Sentiment breakdown */}
        <div className="card">
          <h3 className="text-sm font-medium text-[var(--muted)] mb-4">Sentiment (24h)</h3>
          <div className="space-y-3">
            {(["positive", "negative", "neutral"] as const).map((key) => {
              const count = sb[key] || 0;
              const pct = ((count / sentimentTotal) * 100).toFixed(0);
              return (
                <div key={key} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SENTIMENT_COLORS[key] }} />
                  <span className="text-sm capitalize w-16">{key}</span>
                  <div className="flex-1 h-3 bg-[var(--border)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: SENTIMENT_COLORS[key] }} />
                  </div>
                  <span className="text-sm text-[var(--muted)] w-14 text-right">{count} ({pct}%)</span>
                </div>
              );
            })}
          </div>
          {/* Sentiment gauge */}
          <div className="mt-4 pt-4 border-t border-[var(--border)]">
            <div className="flex justify-between text-xs text-[var(--muted)] mb-1">
              <span>Negative</span><span>Neutral</span><span>Positive</span>
            </div>
            <div className="h-3 bg-gradient-to-r from-red-500 via-gray-500 to-green-500 rounded-full relative">
              <div className="absolute top-0 w-1 h-3 bg-white rounded-full"
                style={{ left: `${Math.min(95, Math.max(5, (Number(sentimentScore) + 100) / 2))}%` }} />
            </div>
          </div>
        </div>

        {/* Platform breakdown */}
        <div className="card">
          <h3 className="text-sm font-medium text-[var(--muted)] mb-4">Platforms (24h)</h3>
          {data.platform_breakdown.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No data yet.</p>
          ) : (
            <div className="space-y-3">
              {data.platform_breakdown.map((p: any) => {
                const maxCount = Math.max(...data.platform_breakdown.map((x: any) => x.count));
                return (
                  <div key={p.platform} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: PLATFORM_COLORS[p.platform] || "#6B7280" }} />
                    <span className="text-sm capitalize w-20">{p.platform}</span>
                    <div className="flex-1 h-3 bg-[var(--border)] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{
                          width: `${(p.count / maxCount) * 100}%`,
                          backgroundColor: PLATFORM_COLORS[p.platform] || "#6B7280",
                        }} />
                    </div>
                    <span className="text-sm text-[var(--muted)] w-10 text-right">{p.count}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-[var(--border)]">
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-400 rounded">YouTube: Live</span>
              <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-400 rounded">HN: Live</span>
              <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-400 rounded">Bluesky: Live</span>
              <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-400 rounded">Mastodon: Live</span>
              <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-400 rounded">News: Live</span>
              <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-400 rounded">Imgur: Live</span>
              <span className="text-xs px-2 py-0.5 bg-yellow-500/10 text-yellow-400 rounded">Reddit: Pending</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card">
          <h3 className="text-sm font-medium text-[var(--muted)] mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <Link href="/memes"
              className="block p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors">
              <div className="text-sm font-medium text-blue-400">Meme Lab</div>
              <div className="text-xs text-[var(--muted)]">Test the meme response pipeline</div>
            </Link>
            <Link href="/topics"
              className="block p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg hover:bg-purple-500/20 transition-colors">
              <div className="text-sm font-medium text-purple-400">Topics</div>
              <div className="text-xs text-[var(--muted)]">Manage monitored topics</div>
            </Link>
            <Link href="/queue"
              className="block p-3 bg-green-500/10 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-colors">
              <div className="text-sm font-medium text-green-400">Meme Queue</div>
              <div className="text-xs text-[var(--muted)]">Review and approve generated memes</div>
            </Link>
            <Link href="/characters"
              className="block p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg hover:bg-yellow-500/20 transition-colors">
              <div className="text-sm font-medium text-yellow-400">Characters</div>
              <div className="text-xs text-[var(--muted)]">Manage posting personas</div>
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-[var(--muted)]">Recent Activity</h3>
          {topics.length > 0 && (
            <Link href={`/topics/${topics[0].id}`} className="text-xs text-blue-400 hover:underline">
              View all posts
            </Link>
          )}
        </div>
        {recentPosts.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No recent activity. Create a topic to start monitoring.</p>
        ) : (
          <div className="space-y-2">
            {recentPosts.map((post: any) => (
              <div key={post.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-[var(--bg)] transition-colors group">
                <div className="shrink-0 mt-1">
                  <div className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: post.sentiment_label
                        ? SENTIMENT_COLORS[post.sentiment_label as keyof typeof SENTIMENT_COLORS] || "#6B7280"
                        : "#6B7280"
                    }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: `${PLATFORM_COLORS[post.platform] || "#6B7280"}20`,
                        color: PLATFORM_COLORS[post.platform] || "#6B7280",
                      }}>{post.platform}</span>
                    <span className="font-medium text-white">{post.author_username || "unknown"}</span>
                    {post.created_at && (
                      <span className="text-[var(--muted)]">{new Date(post.created_at).toLocaleString()}</span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--muted)] mt-0.5 line-clamp-1">{post.content}</p>
                  <div className="flex items-center gap-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {post.url && (
                      <a href={post.url} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] text-blue-400 hover:underline">View original &rarr;</a>
                    )}
                    <button onClick={() => router.push(`/memes?post_id=${post.id}`)}
                      className="text-[10px] px-2 py-0.5 bg-purple-600/80 text-white rounded hover:bg-purple-700 transition-colors">
                      Reply with Meme
                    </button>
                  </div>
                </div>
                {post.sentiment_label && (
                  <span className="shrink-0 text-[10px] capitalize px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: `${SENTIMENT_COLORS[post.sentiment_label as keyof typeof SENTIMENT_COLORS] || "#6B7280"}20`,
                      color: SENTIMENT_COLORS[post.sentiment_label as keyof typeof SENTIMENT_COLORS] || "#6B7280",
                    }}>{post.sentiment_label}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Volume timeline placeholder */}
      {data.volume_timeline.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-medium text-[var(--muted)] mb-4">Volume Timeline (72h)</h3>
          <div className="flex items-end gap-1 h-24">
            {data.volume_timeline.map((point: any, i: number) => {
              const maxCount = Math.max(...data.volume_timeline.map((p: any) => p.count));
              const height = maxCount > 0 ? (point.count / maxCount) * 100 : 0;
              const color = point.avg_sentiment > 0.05 ? SENTIMENT_COLORS.positive
                : point.avg_sentiment < -0.05 ? SENTIMENT_COLORS.negative
                : "#6B7280";
              return (
                <div key={i} className="flex-1 flex flex-col justify-end items-center group relative">
                  <div className="absolute -top-6 hidden group-hover:block text-[10px] text-white bg-[var(--card)] px-1.5 py-0.5 rounded border border-[var(--border)] whitespace-nowrap">
                    {point.count} posts | {new Date(point.hour).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit' })}
                  </div>
                  <div className="w-full rounded-t" style={{ height: `${Math.max(height, 2)}%`, backgroundColor: color, opacity: 0.7 }} />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-[var(--muted)] mt-1">
            <span>{data.volume_timeline.length > 0 && new Date(data.volume_timeline[0].hour).toLocaleDateString()}</span>
            <span>Now</span>
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
