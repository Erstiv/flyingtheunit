"use client";

import { useEffect, useState } from "react";
import { getTopics } from "@/lib/api";
import { PLATFORM_COLORS, SENTIMENT_COLORS } from "@/lib/platform-colors";

export default function MemeLab() {
  const [topics, setTopics] = useState<any[]>([]);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [memes, setMemes] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateStats, setTemplateStats] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"discover" | "create" | "queue">("discover");

  // Create meme form
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [topText, setTopText] = useState("");
  const [bottomText, setBottomText] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    getTopics().then(setTopics);
    fetch("/api/memes/queue").then(r => r.json()).then(setQueue);
  }, []);

  const loadMemes = async (topicId: string) => {
    setLoading(true);
    try {
      const [memesRes, statsRes] = await Promise.all([
        fetch(`/api/memes/trending/${topicId}`).then(r => r.json()),
        fetch(`/api/memes/template-stats/${topicId}`).then(r => r.json()),
      ]);
      setMemes(memesRes);
      setTemplateStats(statsRes);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const loadTemplates = async () => {
    if (templates.length > 0) return;
    const data = await fetch("/api/memes/templates").then(r => r.json());
    setTemplates(data);
  };

  const handleGenerate = async () => {
    if (!selectedTemplate || (!topText && !bottomText)) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/memes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: selectedTemplate,
          top_text: topText,
          bottom_text: bottomText,
          topic_id: selectedTopic || null,
          target_platforms: ["reddit", "imgur"],
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank");
      }
      // Refresh queue
      const q = await fetch("/api/memes/queue").then(r => r.json());
      setQueue(q);
      setTopText("");
      setBottomText("");
    } catch (e) {
      console.error(e);
    }
    setGenerating(false);
  };

  const handleApprove = async (memeId: string) => {
    await fetch(`/api/memes/queue/${memeId}/approve`, { method: "POST" });
    const q = await fetch("/api/memes/queue").then(r => r.json());
    setQueue(q);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Meme Lab</h1>
        <select
          value={selectedTopic}
          onChange={(e) => {
            setSelectedTopic(e.target.value);
            if (e.target.value) loadMemes(e.target.value);
          }}
          className="px-3 py-1.5 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm"
        >
          <option value="">Select a topic...</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--card)] p-1 rounded-lg w-fit">
        {(["discover", "create", "queue"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              if (t === "create") loadTemplates();
            }}
            className={`px-4 py-1.5 rounded text-sm capitalize transition-colors ${
              tab === t ? "bg-blue-600 text-white" : "text-[var(--muted)] hover:text-white"
            }`}
          >
            {t === "queue" ? `Queue (${queue.length})` : t}
          </button>
        ))}
      </div>

      {/* Template Stats */}
      {tab === "discover" && templateStats.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-medium text-[var(--muted)] mb-3">Trending Templates</h3>
          <div className="grid grid-cols-2 gap-2">
            {templateStats.map((ts, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-[var(--bg)] rounded-lg">
                <div>
                  <span className="text-sm font-medium">{ts.template_name}</span>
                  <span className="text-xs text-[var(--muted)] ml-2">{ts.humor_type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--muted)]">{ts.usage_count}x</span>
                  <span
                    className="text-xs"
                    style={{
                      color: ts.avg_sentiment > 0.05 ? SENTIMENT_COLORS.positive
                        : ts.avg_sentiment < -0.05 ? SENTIMENT_COLORS.negative
                        : SENTIMENT_COLORS.neutral,
                    }}
                  >
                    {ts.avg_sentiment > 0 ? "+" : ""}{ts.avg_sentiment.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Discover tab */}
      {tab === "discover" && (
        <div className="space-y-3">
          {loading && <p className="text-[var(--muted)]">Loading memes...</p>}
          {!selectedTopic && !loading && (
            <div className="card text-center py-12">
              <p className="text-[var(--muted)]">Select a topic to discover memes about it</p>
            </div>
          )}
          {memes.map((meme, i) => (
            <div key={i} className="card flex gap-4">
              {/* Image */}
              {meme.image_url && (
                <div className="shrink-0">
                  <img
                    src={meme.image_url}
                    alt={meme.meme_description || "meme"}
                    className="w-32 h-32 object-cover rounded-lg"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              )}
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm mb-1">
                  <span
                    className="px-2 py-0.5 rounded text-xs"
                    style={{
                      backgroundColor: `${PLATFORM_COLORS[meme.platform] || "#6B7280"}20`,
                      color: PLATFORM_COLORS[meme.platform] || "#6B7280",
                    }}
                  >
                    {meme.platform}
                  </span>
                  <span className="font-medium">{meme.author || "unknown"}</span>
                  {meme.template_name && (
                    <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded text-xs">
                      {meme.template_name}
                    </span>
                  )}
                  {meme.humor_type && (
                    <span className="text-xs text-[var(--muted)]">{meme.humor_type}</span>
                  )}
                </div>
                {meme.meme_description && (
                  <p className="text-sm text-[var(--muted)] mb-1">{meme.meme_description}</p>
                )}
                <p className="text-sm line-clamp-2">{meme.content}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-[var(--muted)]">
                  {meme.target_sentiment && (
                    <span
                      style={{
                        color: SENTIMENT_COLORS[meme.target_sentiment as keyof typeof SENTIMENT_COLORS] || "#6B7280",
                      }}
                    >
                      {meme.target_sentiment}
                    </span>
                  )}
                  {Object.entries(meme.engagement || {})
                    .filter(([_, v]) => (v as number) > 0)
                    .slice(0, 3)
                    .map(([k, v]) => (
                      <span key={k}>{v as number} {k}</span>
                    ))}
                  {meme.url && (
                    <a href={meme.url} target="_blank" className="text-blue-400 hover:underline">
                      View original
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create tab */}
      {tab === "create" && (
        <div className="card space-y-4">
          <h3 className="text-sm font-medium">Create a Meme</h3>
          <div>
            <label className="text-sm text-[var(--muted)]">Template</label>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm"
            >
              <option value="">Choose a template...</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          {selectedTemplate && templates.find(t => t.id === selectedTemplate) && (
            <img
              src={templates.find(t => t.id === selectedTemplate)?.url}
              alt="template preview"
              className="w-48 rounded-lg"
            />
          )}
          <div>
            <label className="text-sm text-[var(--muted)]">Top Text</label>
            <input
              value={topText}
              onChange={(e) => setTopText(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm"
              placeholder="Top text..."
            />
          </div>
          <div>
            <label className="text-sm text-[var(--muted)]">Bottom Text</label>
            <input
              value={bottomText}
              onChange={(e) => setBottomText(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm"
              placeholder="Bottom text..."
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating || !selectedTemplate}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate & Queue"}
          </button>
        </div>
      )}

      {/* Queue tab */}
      {tab === "queue" && (
        <div className="space-y-3">
          {queue.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-[var(--muted)]">No memes in the queue. Create one first!</p>
            </div>
          ) : (
            queue.map((meme) => (
              <div key={meme.id} className="card flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{meme.template_name}</div>
                  <div className="text-xs text-[var(--muted)] mt-1">
                    {meme.top_text && <span>Top: "{meme.top_text}" </span>}
                    {meme.bottom_text && <span>Bottom: "{meme.bottom_text}"</span>}
                  </div>
                  {meme.image_url && (
                    <a href={meme.image_url} target="_blank" className="text-xs text-blue-400 hover:underline">
                      Preview
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    meme.status === "draft" ? "bg-yellow-500/10 text-yellow-400" :
                    meme.status === "approved" ? "bg-green-500/10 text-green-400" :
                    "bg-gray-500/10 text-gray-400"
                  }`}>
                    {meme.status}
                  </span>
                  {meme.status === "draft" && (
                    <button
                      onClick={() => handleApprove(meme.id)}
                      className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                    >
                      Approve
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
