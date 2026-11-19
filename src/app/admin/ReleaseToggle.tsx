"use client";

import { useState } from "react";

interface ReleaseToggleProps {
  initialReleased: boolean;
}

export default function ReleaseToggle({ initialReleased }: ReleaseToggleProps) {
  const [released, setReleased] = useState(initialReleased);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const nextState = !released;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ released: nextState }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update release status.");
      } else {
        setReleased(data.released);
      }
    } catch {
      setError("Network error while updating settings.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-3 w-3 rounded-full ${
              released ? "bg-emerald-500 ring-4 ring-emerald-100" : "bg-amber-500 ring-4 ring-amber-100"
            }`}
          />
          <h3 className="text-sm font-bold text-slate-900">
            Certificate Release Status:{" "}
            <span className={released ? "text-emerald-700 font-extrabold" : "text-amber-700 font-extrabold"}>
              {released ? "LIVE (Released)" : "HIDDEN (Coming Soon)"}
            </span>
          </h3>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {released
            ? "Attendees can currently search, verify, and download their certificates on the homepage."
            : "Downloads are locked. Visitors to the home portal will see the 'Certificates will be available soon' banner."}
        </p>
        {error && <p className="mt-1 text-xs font-semibold text-red-600">{error}</p>}
      </div>

      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        className={`shrink-0 rounded-xl px-5 py-2.5 text-xs font-bold transition shadow-sm focus:outline-none focus:ring-2 disabled:opacity-50 ${
          released
            ? "border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 focus:ring-amber-400"
            : "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500"
        }`}
      >
        {loading ? "Updating..." : released ? "🔒 Hide Certificates" : "🚀 Release Certificates"}
      </button>
    </div>
  );
}
