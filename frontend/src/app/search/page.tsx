"use client";

import { useState } from "react";
import { searchPosts, semanticSearch } from "@/lib/api";
import { PLATFORM_COLORS, SENTIMENT_COLORS } from "@/lib/platform-colors";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [mode, setMode] = useState<"text" | "semantic">("text");
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const data = mode === "text" ? await searchPosts(query) : await semanticSearch(query);
      setResults(data);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Search</h1>

      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Search across all collected posts..."
          className="flex-1 px-4 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm"
        />
        <div className="flex bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
          <button
            onClick={() => setMode("text")}
            className={`px-3 py-2 text-xs ${mode === "text" ? "bg-blue-600 text-white" : "text-[var(--muted)]"}`}
          >
            Text
          </button>
          <button
            onClick={() => setMode("semantic")}
            className={`px-3 py-2 text-xs ${mode === "semantic" ? "bg-blue-600 text-white" : "text-[var(--muted)]"}`}
          >
            Semantic
          </button>
        </div>
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "..." : "Search"}
        </button>
      </div>

      {results.length > 0 && (
        <div className="space-y-3">
          <div className="text-sm text-[var(--muted)]">{results.length} results</div>
          {results.map((post: any, i: number) => (
            <div key={post.id || i} className="card">
              <div className="flex items-center gap-2 text-sm mb-2">
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
                {"similarity" in post && (
                  <span className="text-blue-400 text-xs">
                    {(post.similarity * 100).toFixed(1)}% match
                  </span>
                )}
                {post.sentiment_label && (
                  <span
                    className="text-xs capitalize"
                    style={{
                      color: SENTIMENT_COLORS[post.sentiment_label as keyof typeof SENTIMENT_COLORS] || "#6B7280",
                    }}
                  >
                    {post.sentiment_label}
                  </span>
                )}
              </div>
              <p className="text-sm leading-relaxed line-clamp-3">{post.content}</p>
              {post.url && (
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:underline mt-2 block"
                >
                  View original
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
