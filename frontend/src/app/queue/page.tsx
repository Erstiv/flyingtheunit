"use client";

import { useEffect, useState } from "react";
import { SENTIMENT_COLORS } from "@/lib/platform-colors";

export default function QueuePage() {
  const [tab, setTab] = useState<"pending_review" | "approved" | "posted" | "rejected">("pending_review");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/memes/queue?status=${tab}`);
      setItems(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [tab]);

  const handleApprove = async (id: string) => {
    await fetch(`/api/memes/queue/${id}/approve`, { method: "POST" });
    load();
  };

  const tabs = [
    { key: "pending_review", label: "Pending Review", color: "#EAB308" },
    { key: "approved", label: "Approved", color: "#22C55E" },
    { key: "posted", label: "Posted", color: "#3b82f6" },
    { key: "draft", label: "Drafts", color: "#6B7280" },
  ] as const;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Meme Queue</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--card)] p-1 rounded-lg w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`px-4 py-1.5 rounded text-sm transition-colors ${
              tab === t.key
                ? "bg-[var(--bg)] text-white"
                : "text-[var(--muted)] hover:text-white"
            }`}
          >
            <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: t.color }} />
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-[var(--muted)]">Loading...</div>
      ) : items.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-[var(--muted)]">No memes in this queue.</p>
          <p className="text-sm text-[var(--muted)] mt-2">
            {tab === "pending_review"
              ? "Run a simulation in the Meme Lab and approve a meme to see it here."
              : tab === "approved"
              ? "Approved memes will appear here waiting to be posted."
              : "Posted memes and their engagement stats will show here."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item: any) => (
            <div key={item.id} className="card">
              <div className="flex items-start gap-4">
                {/* Meme preview */}
                <div className="w-48 shrink-0">
                  {item.image_url ? (
                    <img src={item.image_url} alt="Meme" className="w-full rounded" />
                  ) : (
                    <div className="bg-gray-800 rounded p-3 space-y-2">
                      <div className="bg-gray-700 rounded p-2 text-center">
                        <div className="text-xs font-bold text-white uppercase">{item.top_text}</div>
                      </div>
                      <div className="bg-gray-700 rounded p-2 text-center">
                        <div className="text-xs font-bold text-white uppercase">{item.bottom_text}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium">{item.template_name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      item.status === "pending_review" ? "bg-yellow-500/10 text-yellow-400"
                      : item.status === "approved" ? "bg-green-500/10 text-green-400"
                      : item.status === "posted" ? "bg-blue-500/10 text-blue-400"
                      : "bg-gray-500/10 text-gray-400"
                    }`}>{item.status.replace("_", " ")}</span>
                  </div>

                  <div className="space-y-1 text-sm">
                    <div><span className="text-[var(--muted)]">Top:</span> {item.top_text}</div>
                    <div><span className="text-[var(--muted)]">Bottom:</span> {item.bottom_text}</div>
                  </div>

                  {item.target_platforms?.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {item.target_platforms.map((p: string) => (
                        <span key={p} className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded capitalize">{p}</span>
                      ))}
                    </div>
                  )}

                  <div className="text-xs text-[var(--muted)] mt-2">
                    Created: {new Date(item.created_at).toLocaleString()}
                  </div>
                </div>

                {/* Actions */}
                <div className="shrink-0 flex flex-col gap-2">
                  {item.status === "pending_review" && (
                    <>
                      <button onClick={() => handleApprove(item.id)}
                        className="px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700">
                        Approve
                      </button>
                    </>
                  )}
                  {item.status === "approved" && (
                    <button className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                      Post Now
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
