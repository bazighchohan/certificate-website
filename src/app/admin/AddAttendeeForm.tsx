"use client";

import { useState, type FormEvent } from "react";

export default function AddAttendeeForm({ onAdded }: { onAdded: () => void }) {
  const [rollNo, setRollNo] = useState("");
  const [name, setName] = useState("");
  const [isSocietyMember, setIsSocietyMember] = useState(false);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!rollNo.trim() || !name.trim()) {
      setError("Please fill in both Roll Number and Full Name.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/attendees/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rollNo,
          name,
          isSocietyMember,
          note: note.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to add attendee.");
      } else {
        setSuccess(data.message || "Attendee added successfully.");
        setRollNo("");
        setName("");
        setIsSocietyMember(false);
        setNote("");
        onAdded();
      }
    } catch {
      setError("Network error while adding attendee.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Add Attendee Manually</h3>
          <p className="text-xs text-slate-500">
            Register a single attendee directly with Participation (and optional Appreciation) certificate.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(!open);
            setError(null);
            setSuccess(null);
          }}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
        >
          {open ? "Close Form" : "+ New Attendee"}
        </button>
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 pt-4 border-t border-slate-100">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="manualRollNo" className="block text-xs font-semibold text-slate-700 mb-1">
                Roll Number *
              </label>
              <input
                id="manualRollNo"
                type="text"
                required
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                placeholder="e.g. 21CS045"
                disabled={loading}
                className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>

            <div>
              <label htmlFor="manualName" className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name *
              </label>
              <input
                id="manualName"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Official full name"
                disabled={loading}
                className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>

            <div>
              <label htmlFor="manualNote" className="block text-xs font-semibold text-slate-700 mb-1">
                Note (Optional)
              </label>
              <input
                id="manualNote"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Late registration, VIP"
                disabled={loading}
                className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isSocietyMember}
                onChange={(e) => setIsSocietyMember(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs font-medium text-slate-700">
                Grant Society Member status (creates Appreciation Certificate too)
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {loading ? "Adding..." : "Save Attendee"}
            </button>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700 ring-1 ring-red-200">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 ring-1 ring-emerald-200">
              ✓ {success}
            </div>
          )}
        </form>
      )}
    </div>
  );
}
