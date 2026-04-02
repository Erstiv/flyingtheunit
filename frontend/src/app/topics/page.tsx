"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getTopics, createTopic, deleteTopic } from "@/lib/api";
import { PLATFORM_COLORS } from "@/lib/platform-colors";

export default function TopicsPage() {
  const [topics, setTopics] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");

  const load = () => getTopics().then(setTopics).catch(console.error);

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!name || !keywords) return;
    await createTopic({
      name,
      keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
    });
    setName("");
    setKeywords("");
    setShowCreate(false);
    load();
  };

  const handleDelete = async (id: string) => {
    await deleteTopic(id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Topics</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showCreate ? "Cancel" : "+ New Topic"}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="card space-y-4">
          <div>
            <label className="text-sm text-[var(--muted)]">Topic Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. AI in Healthcare"
              className="w-full mt-1 px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-sm text-[var(--muted)]">
              Keywords (comma-separated)
            </label>
            <input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder='e.g. "AI healthcare", "medical AI", "clinical AI"'
              className="w-full mt-1 px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm"
            />
          </div>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
          >
            Create & Start Collecting
          </button>
        </div>
      )}

      {/* Topic list */}
      {topics.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-[var(--muted)]">No topics yet. Create one to start monitoring.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {topics.map((topic) => (
            <div key={topic.id} className="card flex items-center justify-between">
              <div>
                <Link
                  href={`/topics/${topic.id}`}
                  className="text-lg font-medium hover:text-blue-400 transition-colors"
                >
                  {topic.name}
                </Link>
                <div className="flex gap-2 mt-1">
                  {topic.keywords.map((kw: string) => (
                    <span
                      key={kw}
                      className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-full"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  {(topic.platforms?.length ? topic.platforms : ["all"]).map(
                    (p: string) => (
                      <span
                        key={p}
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: `${PLATFORM_COLORS[p] || "#6B7280"}20`,
                          color: PLATFORM_COLORS[p] || "#6B7280",
                        }}
                      >
                        {p}
                      </span>
                    )
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    topic.is_active
                      ? "bg-green-500/10 text-green-400"
                      : "bg-gray-500/10 text-gray-400"
                  }`}
                >
                  {topic.is_active ? "Active" : "Paused"}
                </span>
                <button
                  onClick={() => handleDelete(topic.id)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
