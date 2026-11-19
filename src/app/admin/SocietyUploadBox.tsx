"use client";

import { useState, useRef, type FormEvent, type ChangeEvent } from "react";

interface SocietyPreviewData {
  totalInFile: number;
  matchedCount: number;
  unmatchedCount: number;
  alreadyHasAppreciationCount: number;
  duplicatesInFileCount: number;
  matched: { rollNo: string; name: string; alreadyHasAppreciation: boolean }[];
  unmatched: { rollNo: string; name?: string }[];
}

export default function SocietyUploadBox({ onSyncSuccess }: { onSyncSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [addUnmatched, setAddUnmatched] = useState(false);
  const [preview, setPreview] = useState<SocietyPreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingConfirm, setLoadingConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setPreview(null);
    setError(null);
    setSuccess(null);
  }

  async function handlePreview(e: FormEvent) {
    e.preventDefault();
    if (!file) return;

    setLoadingPreview(true);
    setError(null);
    setSuccess(null);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/admin/society-sync", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to parse society CSV.");
      } else {
        setPreview(data);
      }
    } catch {
      setError("Network error inspecting society CSV.");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleConfirm() {
    if (!file) return;

    setLoadingConfirm(true);
    setError(null);
    setSuccess(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("addUnmatched", String(addUnmatched));

    try {
      const res = await fetch("/api/admin/society-sync", {
        method: "PUT",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to apply society members.");
      } else {
        setSuccess(data.message || "Society members updated.");
        setPreview(null);
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        onSyncSuccess();
      }
    } catch {
      setError("Network error while committing society sync.");
    } finally {
      setLoadingConfirm(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
      <div>
        <h3 className="text-base font-bold text-slate-900">Society Member List Sync (Optional)</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Upload a CSV containing a <code className="rounded bg-slate-100 px-1 font-mono">roll_no</code> column
          (name column is optional). For each matching attendee in the system, an Appreciation certificate is granted.
        </p>
      </div>

      <form onSubmit={handlePreview} className="space-y-4">
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            disabled={loadingPreview || loadingConfirm}
            className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-purple-50 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-purple-700 hover:file:bg-purple-100"
          />
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

        <div className="flex gap-2.5">
          <button
            type="submit"
            disabled={!file || loadingPreview || loadingConfirm}
            className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-purple-700 transition disabled:opacity-50"
          >
            {loadingPreview ? "Checking List..." : "Preview Society CSV"}
          </button>
          {preview && (
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Preview Result */}
      {preview && (
        <div className="space-y-4 pt-2 border-t border-slate-100">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-3 text-center border border-slate-200">
              <span className="text-[10px] font-semibold text-slate-500 uppercase">Rolls in File</span>
              <p className="text-xl font-bold text-slate-800">{preview.totalInFile}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 text-center border border-emerald-200">
              <span className="text-[10px] font-semibold text-emerald-700 uppercase">Matched Attendees</span>
              <p className="text-xl font-bold text-emerald-700">{preview.matchedCount}</p>
              <span className="text-[9px] text-emerald-600">
                ({preview.alreadyHasAppreciationCount} already had appreciation)
              </span>
            </div>
            <div className="rounded-xl bg-amber-50 p-3 text-center border border-amber-200">
              <span className="text-[10px] font-semibold text-amber-700 uppercase">Unmatched Rolls</span>
              <p className="text-xl font-bold text-amber-700">{preview.unmatchedCount}</p>
              <span className="text-[9px] text-amber-600">not found in attendees</span>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-center border border-slate-200">
              <span className="text-[10px] font-semibold text-slate-500 uppercase">Duplicates</span>
              <p className="text-xl font-bold text-slate-700">{preview.duplicatesInFileCount}</p>
            </div>
          </div>

          {/* Unmatched Warning & Review */}
          {preview.unmatchedCount > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 space-y-2">
              <h4 className="text-xs font-bold text-amber-900">
                Unmatched Roll Numbers ({preview.unmatchedCount}):
              </h4>
              <p className="text-[11px] text-amber-800">
                These roll numbers are not currently registered as event attendees:
              </p>
              <div className="max-h-24 overflow-y-auto rounded bg-white p-2 text-[11px] font-mono text-slate-700 border border-amber-200">
                {preview.unmatched.map((u, i) => (
                  <span key={i} className="inline-block mr-2 mb-1 bg-slate-100 px-1.5 py-0.5 rounded">
                    {u.rollNo} {u.name ? `(${u.name})` : ""}
                  </span>
                ))}
              </div>

              <label className="flex items-start gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addUnmatched}
                  onChange={(e) => setAddUnmatched(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 rounded text-purple-600 focus:ring-purple-500 border-slate-300"
                />
                <span className="text-xs font-medium text-slate-800">
                  Also add unmatched people as new attendees (requires name column in CSV)
                </span>
              </label>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-slate-600">
              Will grant Appreciation to{" "}
              <strong>{preview.matchedCount - preview.alreadyHasAppreciationCount}</strong> attendee(s)
              {addUnmatched && preview.unmatchedCount > 0
                ? ` and register up to ${preview.unmatchedCount} new attendees`
                : ""}
              .
            </p>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loadingConfirm}
              className="rounded-xl bg-purple-700 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-purple-800 transition disabled:opacity-50"
            >
              {loadingConfirm ? "Applying..." : "Confirm & Apply Society List"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
