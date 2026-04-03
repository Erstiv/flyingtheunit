"use client";

import { useEffect, useState } from "react";

export default function QueuePage() {
  const [tab, setTab] = useState("pending_review");
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

  const action = async (id: string, act: string) => {
    await fetch(`/api/memes/queue/${id}/${act}`, { method: "POST" });
    load();
  };

  const tabs = [
    { key: "pending_review", label: "Pending Review", color: "#EAB308", icon: "!" },
    { key: "approved", label: "Approved", color: "#22C55E", icon: "\u2713" },
    { key: "posted", label: "Posted", color: "#3b82f6", icon: "\u2191" },
    { key: "rejected", label: "Rejected", color: "#EF4444", icon: "\u2717" },
    { key: "draft", label: "Drafts", color: "#6B7280", icon: "\u270E" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Meme Queue</h1>
        <div className="text-xs text-[var(--muted)]">{items.length} items</div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--card)] p-1 rounded-lg w-fit">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded text-sm transition-colors ${
              tab === t.key ? "bg-[var(--bg)] text-white" : "text-[var(--muted)] hover:text-white"
            }`}>
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
              ? "Approved memes waiting to be posted will appear here."
              : tab === "posted"
              ? "Successfully posted memes and their engagement will show here."
              : tab === "rejected"
              ? "Rejected memes are kept here for reference."
              : "Draft memes that haven't been reviewed yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item: any) => (
            <div key={item.id} className="card">
              <div className="flex items-start gap-4">
                {/* Meme preview */}
                <div className="w-52 shrink-0">
                  {item.image_url ? (
                    <img src={item.image_url} alt="Meme" className="w-full rounded" />
                  ) : (
                    <div className="bg-gray-800 rounded p-3 space-y-2">
                      <div className="bg-gray-700 rounded p-2 text-center">
                        <div className="text-[10px] text-[var(--muted)] mb-1">Panel 1</div>
                        <div className="text-xs font-bold text-white uppercase">{item.top_text}</div>
                      </div>
                      <div className="bg-gray-700 rounded p-2 text-center">
                        <div className="text-[10px] text-[var(--muted)] mb-1">Panel 2</div>
                        <div className="text-xs font-bold text-white uppercase">{item.bottom_text}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{item.template_name || "Custom Meme"}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      item.status === "pending_review" ? "bg-yellow-500/10 text-yellow-400"
                      : item.status === "approved" ? "bg-green-500/10 text-green-400"
                      : item.status === "posted" ? "bg-blue-500/10 text-blue-400"
                      : item.status === "rejected" ? "bg-red-500/10 text-red-400"
                      : "bg-gray-500/10 text-gray-400"
                    }`}>{item.status.replace(/_/g, " ")}</span>
                  </div>

                  <div className="text-sm">
                    <span className="text-[var(--muted)]">Top: </span>{item.top_text}
                  </div>
                  <div className="text-sm">
                    <span className="text-[var(--muted)]">Bottom: </span>{item.bottom_text}
                  </div>

                  {item.target_platforms?.length > 0 && (
                    <div className="flex gap-1">
                      <span className="text-[10px] text-[var(--muted)]">Posting to:</span>
                      {item.target_platforms.map((p: string) => (
                        <span key={p} className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded capitalize">{p}</span>
                      ))}
                    </div>
                  )}

                  <div className="text-xs text-[var(--muted)]">
                    Created: {new Date(item.created_at).toLocaleString()}
                  </div>
                </div>

                {/* Actions */}
                <div className="shrink-0 flex flex-col gap-2">
                  {item.status === "pending_review" && (
                    <>
                      <button onClick={() => action(item.id, "approve")}
                        className="px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700">
                        Approve
                      </button>
                      <button onClick={() => action(item.id, "reject")}
                        className="px-3 py-1.5 bg-red-600/80 text-white text-xs rounded hover:bg-red-700">
                        Reject
                      </button>
                    </>
                  )}
                  {item.status === "approved" && (
                    <>
                      <button className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                        Post Now
                      </button>
                      <button onClick={() => action(item.id, "unapprove")}
                        className="px-3 py-1.5 bg-gray-600 text-white text-xs rounded hover:bg-gray-700">
                        Un-approve
                      </button>
                    </>
                  )}
                  {item.status === "posted" && (
                    <button onClick={() => action(item.id, "repost")}
                      className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                      Repost
                    </button>
                  )}
                  {item.status === "rejected" && (
                    <button onClick={() => action(item.id, "unapprove")}
                      className="px-3 py-1.5 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700">
                      Reconsider
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
