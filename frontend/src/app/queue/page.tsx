"use client";

import { useEffect, useState } from "react";

/* ── Lightbox Modal ── */
function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8"
      onClick={onClose}>
      <div className="relative max-w-3xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose}
          className="absolute -top-3 -right-3 w-8 h-8 bg-[var(--card)] border border-[var(--border)] rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors text-sm">
          &#10005;
        </button>
        <img src={src} alt={alt} className="max-w-full max-h-[85vh] rounded-lg shadow-2xl" />
      </div>
    </div>
  );
}

export default function QueuePage() {
  const [tab, setTab] = useState("pending_review");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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
    setActionLoading(`${id}-${act}`);
    try {
      await fetch(`/api/memes/queue/${id}/${act}`, { method: "POST" });
      load();
    } finally {
      setActionLoading(null);
    }
  };

  const tabs = [
    { key: "pending_review", label: "Pending Review", color: "#EAB308", icon: "!" },
    { key: "approved", label: "Approved", color: "#22C55E", icon: "\u2713" },
    { key: "posted", label: "Posted", color: "#3b82f6", icon: "\u2191" },
    { key: "rejected", label: "Rejected", color: "#EF4444", icon: "\u2717" },
    { key: "draft", label: "Drafts", color: "#6B7280", icon: "\u270E" },
  ];

  const emptyMessages: Record<string, { title: string; sub: string }> = {
    pending_review: { title: "No memes awaiting review", sub: "Run a simulation in the Meme Lab and approve a meme to see it here." },
    approved: { title: "No approved memes", sub: "Approved memes waiting to be posted will appear here." },
    posted: { title: "No posted memes yet", sub: "Successfully posted memes and their engagement will show here." },
    rejected: { title: "No rejected memes", sub: "Rejected memes are kept here for reference." },
    draft: { title: "No drafts", sub: "Draft memes that haven't been reviewed yet." },
  };

  return (
    <div className="space-y-6">
      {lightboxSrc && <Lightbox src={lightboxSrc} alt="Meme preview" onClose={() => setLightboxSrc(null)} />}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Meme Queue</h1>
        <div className="flex items-center gap-3">
          <div className="text-xs text-[var(--muted)]">{items.length} item{items.length !== 1 ? "s" : ""}</div>
          <button onClick={load} disabled={loading}
            className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50">
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--card)] p-1 rounded-lg w-fit overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded text-sm transition-colors whitespace-nowrap ${
              tab === t.key ? "bg-[var(--bg)] text-white" : "text-[var(--muted)] hover:text-white"
            }`}>
            <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: t.color }} />
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-52 h-32 bg-[var(--border)] rounded shrink-0" />
                <div className="flex-1 space-y-3">
                  <div className="h-4 w-48 bg-[var(--border)] rounded" />
                  <div className="h-3 w-64 bg-[var(--border)] rounded" />
                  <div className="h-3 w-56 bg-[var(--border)] rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-4xl mb-4 opacity-20">
            {tab === "pending_review" ? "!" : tab === "approved" ? "\u2713" : tab === "posted" ? "\u2191" : tab === "rejected" ? "\u2717" : "\u270E"}
          </div>
          <p className="text-[var(--muted)] font-medium">{emptyMessages[tab]?.title}</p>
          <p className="text-sm text-[var(--muted)] mt-2 max-w-md mx-auto">{emptyMessages[tab]?.sub}</p>
          {tab === "pending_review" && (
            <a href="/memes" className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
              Go to Meme Lab
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item: any) => (
            <div key={item.id} className="card hover:border-[var(--muted)]/30 transition-colors"
              style={{ animation: "fadeSlideIn 0.3s ease-out" }}>
              <div className="flex items-start gap-4">
                {/* Meme preview */}
                <div className="w-52 shrink-0">
                  {item.image_url ? (
                    <img src={item.image_url} alt="Meme"
                      className="w-full rounded cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setLightboxSrc(item.image_url)} />
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
                    <div className="flex gap-1 items-center">
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
                        disabled={actionLoading === `${item.id}-approve`}
                        className="px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50 transition-colors">
                        {actionLoading === `${item.id}-approve` ? "..." : "Approve"}
                      </button>
                      <button onClick={() => action(item.id, "reject")}
                        disabled={actionLoading === `${item.id}-reject`}
                        className="px-3 py-1.5 bg-red-600/80 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50 transition-colors">
                        {actionLoading === `${item.id}-reject` ? "..." : "Reject"}
                      </button>
                    </>
                  )}
                  {item.status === "approved" && (
                    <>
                      <button className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors">
                        Post Now
                      </button>
                      <button onClick={() => action(item.id, "unapprove")}
                        disabled={actionLoading === `${item.id}-unapprove`}
                        className="px-3 py-1.5 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 disabled:opacity-50 transition-colors">
                        {actionLoading === `${item.id}-unapprove` ? "..." : "Un-approve"}
                      </button>
                    </>
                  )}
                  {item.status === "posted" && (
                    <button onClick={() => action(item.id, "repost")}
                      disabled={actionLoading === `${item.id}-repost`}
                      className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 transition-colors">
                      {actionLoading === `${item.id}-repost` ? "..." : "Repost"}
                    </button>
                  )}
                  {item.status === "rejected" && (
                    <button onClick={() => action(item.id, "unapprove")}
                      disabled={actionLoading === `${item.id}-unapprove`}
                      className="px-3 py-1.5 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700 disabled:opacity-50 transition-colors">
                      {actionLoading === `${item.id}-unapprove` ? "..." : "Reconsider"}
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
