"use client";

export default function GraphPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Graph Explorer</h1>
      <div className="card text-center py-12">
        <p className="text-[var(--muted)]">Interactive graph visualization coming in Phase 2.</p>
        <p className="text-sm text-[var(--muted)] mt-2">
          Cytoscape.js graph explorer with entity connections, platform coloring,
          and community detection.
        </p>
      </div>
    </div>
  );
}
