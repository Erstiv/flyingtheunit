"use client";

export default function EntitiesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Entities</h1>
      <div className="card text-center py-12">
        <p className="text-[var(--muted)]">Entity browser coming in Phase 2.</p>
        <p className="text-sm text-[var(--muted)] mt-2">
          Entities are automatically extracted from posts using NER and will appear here
          once collection is running.
        </p>
      </div>
    </div>
  );
}
