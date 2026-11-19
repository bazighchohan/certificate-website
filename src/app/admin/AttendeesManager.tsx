"use client";

import { useState, useEffect, useCallback } from "react";
import { CERT_LABELS, type CertType } from "@/lib/cert-types";

interface AttendeeRow {
  id: string;
  roll_no: string;
  name: string;
  cert_type: CertType;
  cert_id: string;
  download_count: number;
  created_at: string;
}

export default function AttendeesManager() {
  const [attendees, setAttendees] = useState<AttendeeRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [certType, setCertType] = useState<string>("");
  const [downloadFilter, setDownloadFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const pageSize = 25;

  const fetchAttendees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (certType) params.set("certType", certType);
      if (downloadFilter) params.set("downloadFilter", downloadFilter);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const res = await fetch(`/api/admin/attendees?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load attendees.");
      } else {
        setAttendees(data.attendees || []);
        setTotalCount(data.totalCount || 0);
      }
    } catch {
      setError("Network error while loading attendees.");
    } finally {
      setLoading(false);
    }
  }, [search, certType, downloadFilter, page]);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchAttendees();
    }, 250);
    return () => clearTimeout(handler);
  }, [fetchAttendees]);

  async function handleDelete(row: AttendeeRow) {
    const ok = window.confirm(
      `Are you sure you want to delete the ${CERT_LABELS[row.cert_type]} record for ${row.name} (${row.roll_no})?`
    );
    if (!ok) return;

    setDeletingId(row.id);
    try {
      const res = await fetch(`/api/admin/attendees/${row.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to delete attendee.");
      } else {
        fetchAttendees();
      }
    } catch {
      alert("Network error while deleting attendee.");
    } finally {
      setDeletingId(null);
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Registered Certificates</h2>
          <p className="text-xs text-slate-500">
            Browse, search, inspect download counts, or remove individual records.
          </p>
        </div>

        <a
          href="/api/admin/export/downloaded"
          download
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-2 text-xs font-bold text-indigo-700 shadow-sm transition hover:bg-indigo-100 hover:border-indigo-300"
        >
          <span>📥</span> Export Downloaded CSV
        </a>
      </div>

      {/* Filter Controls */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label htmlFor="search" className="block text-xs font-semibold text-slate-600 mb-1">
            Search
          </label>
          <input
            id="search"
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search roll no, name, or cert ID..."
            className="block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>

        <div>
          <label htmlFor="certTypeFilter" className="block text-xs font-semibold text-slate-600 mb-1">
            Certificate Type
          </label>
          <select
            id="certTypeFilter"
            value={certType}
            onChange={(e) => {
              setCertType(e.target.value);
              setPage(1);
            }}
            className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          >
            <option value="">All Types</option>
            <option value="participation">Participation</option>
            <option value="appreciation">Appreciation</option>
          </select>
        </div>

        <div>
          <label htmlFor="downloadFilter" className="block text-xs font-semibold text-slate-600 mb-1">
            Download Status
          </label>
          <select
            id="downloadFilter"
            value={downloadFilter}
            onChange={(e) => {
              setDownloadFilter(e.target.value);
              setPage(1);
            }}
            className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          >
            <option value="">All Attendees</option>
            <option value="downloaded">Downloaded (≥ 1)</option>
            <option value="not_downloaded">Not Downloaded (0)</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="max-h-[30rem] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-100 font-semibold text-slate-700 z-10">
              <tr>
                <th className="px-4 py-2.5">Roll Number</th>
                <th className="px-4 py-2.5">Full Name</th>
                <th className="px-4 py-2.5">Certificate Type</th>
                <th className="px-4 py-2.5">Cert ID</th>
                <th className="px-4 py-2.5 text-center">Downloads</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && attendees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Loading attendees...
                  </td>
                </tr>
              ) : attendees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No attendees match your search and filters.
                  </td>
                </tr>
              ) : (
                attendees.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-2.5 font-mono font-bold text-slate-800">
                      {row.roll_no}
                    </td>
                    <td className="px-4 py-2.5 text-slate-900 font-medium">{row.name}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          row.cert_type === "appreciation"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {CERT_LABELS[row.cert_type] || row.cert_type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">
                      {row.cert_id}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          row.download_count > 0
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {row.download_count}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(row)}
                        disabled={deletingId === row.id}
                        className="rounded-lg border border-red-200 bg-red-50/50 px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100 transition disabled:opacity-50"
                      >
                        {deletingId === row.id ? "Deleting..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between pt-2 text-xs text-slate-500">
        <span>
          Showing {attendees.length} of {totalCount} records
        </span>

        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-medium hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-2 font-mono">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-medium hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
