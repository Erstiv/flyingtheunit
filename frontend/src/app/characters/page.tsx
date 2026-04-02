"use client";

import { useEffect, useState } from "react";

export default function CharactersPage() {
  const [characters, setCharacters] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "", handle: "", bio: "", property_id: "", personality: "",
  });
  const [creating, setCreating] = useState(false);

  const load = () => fetch("/api/characters/").then(r => r.json()).then(setCharacters);

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.name || !form.personality || !form.property_id) return;
    setCreating(true);
    await fetch("/api/characters/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ name: "", handle: "", bio: "", property_id: "", personality: "" });
    setShowCreate(false);
    setCreating(false);
    load();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/characters/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Characters</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          {showCreate ? "Cancel" : "+ New Character"}
        </button>
      </div>

      {showCreate && (
        <div className="card space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-[var(--muted)]">Character Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. WayfinderNerd"
                className="w-full mt-1 px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-[var(--muted)]">Handle</label>
              <input
                value={form.handle}
                onChange={(e) => setForm({ ...form, handle: e.target.value })}
                placeholder="@wayfindernerd"
                className="w-full mt-1 px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-[var(--muted)]">Property (show name, lowercase)</label>
            <input
              value={form.property_id}
              onChange={(e) => setForm({ ...form, property_id: e.target.value })}
              placeholder="e.g. the wayfinders"
              className="w-full mt-1 px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-sm text-[var(--muted)]">Bio</label>
            <input
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="Short bio for the character's profile"
              className="w-full mt-1 px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-sm text-[var(--muted)]">Personality (detailed prompt)</label>
            <textarea
              value={form.personality}
              onChange={(e) => setForm({ ...form, personality: e.target.value })}
              placeholder="A snarky superfan who loves pointing out continuity errors and making obscure references to episode details..."
              rows={4}
              className="w-full mt-1 px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm"
            />
            <p className="text-xs text-[var(--muted)] mt-1">
              This prompt defines how the character writes meme text. Be specific about tone, humor style, and what they focus on.
            </p>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !form.name || !form.personality || !form.property_id}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create Character"}
          </button>
        </div>
      )}

      {characters.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-[var(--muted)]">No characters yet.</p>
          <p className="text-sm text-[var(--muted)] mt-2">
            Characters are personas that generate and post memes on behalf of a property.
            Each character has a unique voice and personality.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {characters.map((char) => (
            <div key={char.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-medium">{char.name}</span>
                    {char.handle && (
                      <span className="text-sm text-blue-400">{char.handle}</span>
                    )}
                    <span className="text-xs px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded">
                      {char.property_id}
                    </span>
                  </div>
                  {char.bio && <p className="text-sm text-[var(--muted)] mt-1">{char.bio}</p>}
                  <p className="text-xs text-[var(--muted)] mt-2 italic">
                    "{char.personality}"
                  </p>
                  {char.engagement_stats && Object.keys(char.engagement_stats).length > 0 && (
                    <div className="flex gap-3 mt-2 text-xs text-[var(--muted)]">
                      {Object.entries(char.engagement_stats).map(([k, v]) => (
                        <span key={k}>{k}: {String(v)}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    char.is_active ? "bg-green-500/10 text-green-400" : "bg-gray-500/10 text-gray-400"
                  }`}>
                    {char.is_active ? "Active" : "Paused"}
                  </span>
                  <button
                    onClick={() => handleDelete(char.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
