"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getTopic, getTopicPosts, getTopicTimeline } from "@/lib/api";
import { PLATFORM_COLORS, SENTIMENT_COLORS } from "@/lib/platform-colors";

export default function TopicDetailPage() {
  const params = useParams();
  const router = useRouter();
  const topicId = params.id as string;
  const [topic, setTopic] = useState<any>(null);
  const [posts, setPosts] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [filter, setFilter] = useState<{ sentiment?: string; platform?: string }>({});
  const [page, setPage] = useState(1);

  useEffect(() => {
    getTopic(topicId).then(setTopic).catch(console.error);
    getTopicTimeline(topicId).then(setTimeline).catch(console.error);
  }, [topicId]);

  useEffect(() => {
    const params: Record<string, string> = { page: String(page) };
    if (filter.sentiment) params.sentiment = filter.sentiment;
    if (filter.platform) params.platform = filter.platform;
    getTopicPosts(topicId, params).then(setPosts).catch(console.error);
  }, [topicId, page, filter]);

  if (!topic) return <div className="text-[var(--muted)]">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{topic.topic.name}</h1>
        <div className="flex gap-4 mt-2 text-sm text-[var(--muted)]">
          <span>{topic.total_posts} total posts</span>
          <span>{topic.volume_24h} in last 24h</span>
          {topic.avg_sentiment != null && (
            <span>
              Avg sentiment:{" "}
              <span
                style={{
                  color:
                    topic.avg_sentiment > 0.05
                      ? SENTIMENT_COLORS.positive
                      : topic.avg_sentiment < -0.05
                      ? SENTIMENT_COLORS.negative
                      : SENTIMENT_COLORS.neutral,
                }}
              >
                {topic.avg_sentiment.toFixed(2)}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Platform breakdown */}
      {Object.keys(topic.platform_breakdown).length > 0 && (
        <div className="card">
          <h3 className="text-sm font-medium text-[var(--muted)] mb-3">Platform Breakdown</h3>
          <div className="flex gap-4">
            {Object.entries(topic.platform_breakdown).map(([platform, count]: any) => (
              <button
                key={platform}
                onClick={() =>
                  setFilter((f) =>
                    f.platform === platform ? { ...f, platform: undefined } : { ...f, platform }
                  )
                }
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  filter.platform === platform
                    ? "ring-2 ring-blue-500"
                    : ""
                }`}
                style={{
                  backgroundColor: `${PLATFORM_COLORS[platform] || "#6B7280"}15`,
                  color: PLATFORM_COLORS[platform] || "#6B7280",
                }}
              >
                {platform}: {count}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sentiment filter */}
      <div className="flex gap-2">
        {["positive", "negative", "neutral"].map((s) => (
          <button
            key={s}
            onClick={() =>
              setFilter((f) =>
                f.sentiment === s ? { ...f, sentiment: undefined } : { ...f, sentiment: s }
              )
            }
            className={`px-3 py-1 rounded-full text-xs capitalize transition-colors ${
              filter.sentiment === s ? "ring-2 ring-white" : ""
            }`}
            style={{
              backgroundColor: `${SENTIMENT_COLORS[s as keyof typeof SENTIMENT_COLORS]}20`,
              color: SENTIMENT_COLORS[s as keyof typeof SENTIMENT_COLORS],
            }}
          >
            {s}
          </button>
        ))}
        {(filter.sentiment || filter.platform) && (
          <button
            onClick={() => setFilter({})}
            className="px-3 py-1 rounded-full text-xs bg-gray-500/20 text-gray-400"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Post feed */}
      {posts && (
        <div className="space-y-3">
          <div className="text-sm text-[var(--muted)]">
            {posts.total} posts (page {posts.page})
          </div>
          {posts.posts.map((post: any) => (
            <div key={post.id} className="card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      className="px-2 py-0.5 rounded text-xs"
                      style={{
                        backgroundColor: `${PLATFORM_COLORS[post.platform] || "#6B7280"}20`,
                        color: PLATFORM_COLORS[post.platform] || "#6B7280",
                      }}
                    >
                      {post.platform}
                    </span>
                    <span className="font-medium">{post.author_username || "unknown"}</span>
                    {post.created_at && (
                      <span className="text-[var(--muted)]">
                        {new Date(post.created_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed line-clamp-4">
                    {post.content}
                  </p>
                  {post.entities?.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {post.entities.map((ent: any, i: number) => (
                        <span
                          key={i}
                          className="text-xs px-1.5 py-0.5 bg-purple-500/10 text-purple-400 rounded"
                        >
                          {ent.name} ({ent.type})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {post.sentiment_label && (
                  <div className="shrink-0 text-right space-y-1">
                    <span
                      className="inline-block px-2 py-1 rounded text-xs capitalize"
                      style={{
                        backgroundColor: `${
                          SENTIMENT_COLORS[post.sentiment_label as keyof typeof SENTIMENT_COLORS] || "#6B7280"
                        }20`,
                        color:
                          SENTIMENT_COLORS[post.sentiment_label as keyof typeof SENTIMENT_COLORS] || "#6B7280",
                      }}
                    >
                      {post.sentiment_label} ({post.sentiment_score?.toFixed(2)})
                    </span>
                    {post.emotions && Object.keys(post.emotions).length > 0 && (
                      <div className="text-[10px] text-[var(--muted)] space-y-0.5">
                        {post.emotions.positive > 0 && <div>+positive: {(post.emotions.positive * 100).toFixed(0)}%</div>}
                        {post.emotions.negative > 0 && <div>-negative: {(post.emotions.negative * 100).toFixed(0)}%</div>}
                        {post.emotions.neutral > 0 && <div>~neutral: {(post.emotions.neutral * 100).toFixed(0)}%</div>}
                      </div>
                    )}
                    {post.engagement && (
                      <div className="text-[10px] text-[var(--muted)]">
                        {Object.entries(post.engagement)
                          .filter(([_, v]) => (v as number) > 0)
                          .map(([k, v]) => `${v} ${k}`)
                          .join(" / ")}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 mt-2">
                {post.url && (
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:underline"
                  >
                    View original &rarr;
                  </a>
                )}
                <button
                  onClick={() => router.push(`/memes?post_id=${post.id}`)}
                  className="text-xs px-2.5 py-1 bg-purple-600/80 text-white rounded hover:bg-purple-700 transition-colors"
                >
                  Reply with Meme
                </button>
              </div>
            </div>
          ))}

          {/* Pagination */}
          {posts.total > posts.page_size && (
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm bg-[var(--card)] border border-[var(--border)] rounded disabled:opacity-30"
              >
                Prev
              </button>
              <span className="text-sm text-[var(--muted)] py-1">
                Page {page} of {Math.ceil(posts.total / posts.page_size)}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page * posts.page_size >= posts.total}
                className="px-3 py-1 text-sm bg-[var(--card)] border border-[var(--border)] rounded disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
