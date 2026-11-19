"use client";

import { useState, useRef, type FormEvent, type ChangeEvent } from "react";

interface PreviewData {
  totalCsvRows: number;
  validAttendees: number;
  invalidRows: number;
  duplicateRows: number;
  societyMembers: number;
  totalTargetCertRows: number;
  newCertRows: number;
  existingCertRows: number;
  rows: {
    rowNum: number;
    rollNo: string;
    name: string;
    isSocietyMember: boolean;
    status: "valid" | "invalid" | "duplicate" | "existing" | "new";
    error?: string;
    details?: {
      participation: string;
      appreciation: string;
    };
  }[];
  hasMoreRows: boolean;
  errors: string[];
}

export default function AdminUploadClient() {
  const [file, setFile] = useState<File | null>(null);
  const [purgeMissing, setPurgeMissing] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingConfirm, setLoadingConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setPreview(null);
    setError(null);
    setSuccessMessage(null);
  }

  async function handlePreview(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Please select a CSV file.");
      return;
    }

    setLoadingPreview(true);
    setError(null);
    setSuccessMessage(null);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/admin/upload/preview", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to generate CSV preview.");
      } else {
        setPreview(data);
      }
    } catch {
      setError("Network error while inspecting CSV file.");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleConfirm() {
    if (!file) return;

    if (purgeMissing) {
      const ok = window.confirm(
        "WARNING: You checked 'Remove rows not in this file'. Any attendee certificates in the database not included in this file will be PERMANENTLY deleted. Do you want to proceed?"
      );
      if (!ok) return;
    }

    setLoadingConfirm(true);
    setError(null);
    setSuccessMessage(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("purgeMissing", String(purgeMissing));

    try {
      const res = await fetch("/api/admin/upload/confirm", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to commit records.");
      } else {
        setSuccessMessage(data.message || "Import completed successfully.");
        setPreview(null);
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } catch {
      setError("Network error while importing records.");
    } finally {
      setLoadingConfirm(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Upload Attendees CSV</h2>
        <p className="mt-1 text-sm text-slate-500">
          Upload a single CSV containing all attendees. Every attendee automatically receives a{" "}
          <strong className="text-slate-700">Participation Certificate</strong>. Attendees marked as
          society members also receive an <strong className="text-slate-700">Appreciation Certificate</strong>.
        </p>

        <form onSubmit={handlePreview} className="mt-6 space-y-5">
          <div>
            <label htmlFor="csvFile" className="block text-sm font-semibold text-slate-700">
              CSV File
            </label>
            <p className="mt-0.5 text-xs text-slate-500">
              Required headers: <code className="rounded bg-slate-100 px-1 py-0.5 font-mono">roll_no</code>,{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono">name</code>, and optional{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono">is_society_member</code> (e.g. yes, y, true, 1).
            </p>
            <input
              id="csvFile"
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              disabled={loadingPreview || loadingConfirm}
              className="mt-2.5 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={purgeMissing}
                onChange={(e) => setPurgeMissing(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="text-sm font-semibold text-slate-900">
                  Remove rows not in this file (Sync Mode)
                </span>
                <p className="text-xs text-slate-500">
                  When unticked (default), re-uploading only updates names and adds missing rows without deleting anything.
                  When ticked, any certificates in the database not present in this file will be permanently removed.
                </p>
              </div>
            </label>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 ring-1 ring-emerald-200">
              ✓ {successMessage}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!file || loadingPreview || loadingConfirm}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loadingPreview ? "Analyzing File..." : "Preview & Validate CSV"}
            </button>
            {preview && (
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Clear Preview
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Preview Section */}
      {preview && (
        <div className="space-y-6">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-center shadow-sm">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Total CSV Rows</span>
              <p className="mt-1 text-2xl font-bold text-slate-900">{preview.totalCsvRows}</p>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3.5 text-center shadow-sm">
              <span className="text-[11px] font-medium text-indigo-700 uppercase tracking-wide">Society Members</span>
              <p className="mt-1 text-2xl font-bold text-indigo-700">{preview.societyMembers}</p>
              <span className="text-[10px] text-indigo-600 font-medium">gets 2 certs</span>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 text-center shadow-sm">
              <span className="text-[11px] font-medium text-emerald-700 uppercase tracking-wide">New Certs</span>
              <p className="mt-1 text-2xl font-bold text-emerald-700">{preview.newCertRows}</p>
              <span className="text-[10px] text-emerald-600 font-medium">+new cert_id</span>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3.5 text-center shadow-sm">
              <span className="text-[11px] font-medium text-blue-700 uppercase tracking-wide">Existing Certs</span>
              <p className="mt-1 text-2xl font-bold text-blue-700">{preview.existingCertRows}</p>
              <span className="text-[10px] text-blue-600 font-medium">updates name</span>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 text-center shadow-sm">
              <span className="text-[11px] font-medium text-amber-700 uppercase tracking-wide">Duplicate Rolls</span>
              <p className="mt-1 text-2xl font-bold text-amber-700">{preview.duplicateRows}</p>
              <span className="text-[10px] text-amber-600 font-medium">in file (skipped)</span>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50/40 p-3.5 text-center shadow-sm">
              <span className="text-[11px] font-medium text-red-700 uppercase tracking-wide">Invalid Rows</span>
              <p className="mt-1 text-2xl font-bold text-red-700">{preview.invalidRows}</p>
              <span className="text-[10px] text-red-600 font-medium">missing info</span>
            </div>
          </div>

          {/* Action Confirmation Banner */}
          <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-indigo-200 bg-indigo-50/60 p-5 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-sm font-bold text-indigo-950">
                Ready to commit {preview.validAttendees} attendees ({preview.totalTargetCertRows} total certificates)?
              </h3>
              <p className="mt-0.5 text-xs text-indigo-700">
                Participation for all {preview.validAttendees} attendees + Appreciation for {preview.societyMembers} society members.
                {purgeMissing && (
                  <span className="block font-semibold text-red-600">
                    ⚠ Warning: Purge mode enabled. Records not in this file will be deleted.
                  </span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loadingConfirm || preview.validAttendees === 0}
              className={`w-full shrink-0 rounded-xl px-6 py-2.5 text-sm font-bold text-white shadow-sm transition focus:outline-none focus:ring-2 disabled:opacity-50 sm:w-auto ${
                purgeMissing
                  ? "bg-red-600 hover:bg-red-700 focus:ring-red-500"
                  : "bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500"
              }`}
            >
              {loadingConfirm
                ? "Processing Upsert..."
                : purgeMissing
                ? "Confirm & Sync (With Deletions)"
                : "Confirm & Upsert Records"}
            </button>
          </div>

          {/* Detail Preview Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-3.5 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                Row Breakdown {preview.hasMoreRows && "(Showing first 500)"}
              </h3>
              <span className="text-xs text-slate-500">
                {preview.validAttendees} valid attendees
              </span>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-100 font-semibold text-slate-700">
                  <tr>
                    <th className="px-4 py-2.5 w-14">Row</th>
                    <th className="px-4 py-2.5">Roll Number</th>
                    <th className="px-4 py-2.5">Name</th>
                    <th className="px-4 py-2.5">Society Member?</th>
                    <th className="px-4 py-2.5">Certificates Target</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.rows.map((r, i) => (
                    <tr
                      key={i}
                      className={
                        r.status === "invalid" || r.status === "duplicate"
                          ? "bg-red-50/40"
                          : r.isSocietyMember
                          ? "bg-indigo-50/25"
                          : "bg-white"
                      }
                    >
                      <td className="px-4 py-2 text-slate-400 font-mono">{r.rowNum}</td>
                      <td className="px-4 py-2 font-mono font-medium text-slate-800">
                        {r.rollNo || "—"}
                      </td>
                      <td className="px-4 py-2 text-slate-700">{r.name || "—"}</td>
                      <td className="px-4 py-2">
                        {r.isSocietyMember ? (
                          <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800">
                            ★ Yes (Member)
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">No</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-[11px] text-slate-600">
                        {r.details ? (
                          <span>
                            Participation: <em>{r.details.participation}</em>
                            {r.isSocietyMember && (
                              <>, Appreciation: <em>{r.details.appreciation}</em></>
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {r.status === "new" && (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                            + New
                          </span>
                        )}
                        {r.status === "existing" && (
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                            ↻ Update Name
                          </span>
                        )}
                        {r.status === "duplicate" && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800" title={r.error}>
                            ⚠ Dup in CSV
                          </span>
                        )}
                        {r.status === "invalid" && (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-800" title={r.error}>
                            ✕ {r.error || "Invalid"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
