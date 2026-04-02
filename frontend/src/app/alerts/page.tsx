"use client";

export default function AlertsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Alerts</h1>
      <div className="card text-center py-12">
        <p className="text-[var(--muted)]">Alert system coming in Phase 3.</p>
        <p className="text-sm text-[var(--muted)] mt-2">
          Configure volume spike, sentiment shift, and new entity alerts
          with email/webhook notifications.
        </p>
      </div>
    </div>
  );
}
