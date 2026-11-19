"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import AddAttendeeForm from "./AddAttendeeForm";

export interface AttendeePersonGroup {
  roll_no: string;
  name: string;
  source: "csv" | "manual";
  note: string | null;
  isSocietyMember: boolean;
  participation: {
    id: string;
    cert_id: string;
    download_count: number;
    created_at: string;
  } | null;
  appreciation: {
    id: string;
    cert_id: string;
    download_count: number;
    created_at: string;
  } | null;
}

export default function AttendeesManager() {
  const [persons, setPersons] = useState<AttendeePersonGroup[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [downloadFilter, setDownloadFilter] = useState<string>("");
  const [societyOnly, setSocietyOnly] = useState<boolean>(false);
  const [page, setPage] = useState(1);

  // In-flight states
  const [togglingRoll, setTogglingRoll] = useState<string | null>(null);
  const [deletingRoll, setDeletingRoll] = useState<string | null>(null);

  // Edit Modal
  const [editingPerson, setEditingPerson] = useState<AttendeePersonGroup | null>(null);
  const [editRollNo, setEditRollNo] = useState("");
  const [editName, setEditName] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const pageSize = 25;

  const fetchPersons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (downloadFilter) params.set("downloadFilter", downloadFilter);
      if (societyOnly) params.set("societyOnly", "true");
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const res = await fetch(`/api/admin/attendees?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load attendees.");
      } else {
        setPersons(data.persons || []);
        setTotalCount(data.totalCount || 0);
      }
    } catch {
      setError("Network error while loading attendees.");
    } finally {
      setLoading(false);
    }
  }, [search, downloadFilter, societyOnly, page]);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchPersons();
    }, 250);
    return () => clearTimeout(handler);
  }, [fetchPersons]);

  // Toggle society membership
  async function handleSocietyToggle(p: AttendeePersonGroup) {
    const nextState = !p.isSocietyMember;

    if (!nextState && p.appreciation && p.appreciation.download_count > 0) {
      const confirmed = window.confirm(
        `WARNING: ${p.name}'s Appreciation Certificate has already been downloaded (${p.appreciation.download_count} time(s)).\n\nRemoving their society status will delete their Appreciation certificate record. If re-enabled later, they will receive a new certificate record and can download again only after being granted. Do you want to proceed?`
      );
      if (!confirmed) return;
    }

    setTogglingRoll(p.roll_no);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/admin/attendees/by-roll/${encodeURIComponent(p.roll_no)}/society`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enable: nextState }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to update society membership.");
      } else {
        setActionMessage(data.message);
        fetchPersons();
      }
    } catch {
      alert("Network error toggling society member status.");
    } finally {
      setTogglingRoll(null);
    }
  }

  // Delete all records for person
  async function handleDeletePerson(p: AttendeePersonGroup) {
    const ok = window.confirm(
      `Delete ALL certificate records for ${p.name} (${p.roll_no})? This will remove their participation and any appreciation certificates.`
    );
    if (!ok) return;

    setDeletingRoll(p.roll_no);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/admin/attendees/by-roll/${encodeURIComponent(p.roll_no)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to delete attendee.");
      } else {
        setActionMessage(data.message);
        fetchPersons();
      }
    } catch {
      alert("Network error deleting attendee.");
    } finally {
      setDeletingRoll(null);
    }
  }

  // Open edit modal
  function openEdit(p: AttendeePersonGroup) {
    setEditingPerson(p);
    setEditRollNo(p.roll_no);
    setEditName(p.name);
    setEditNote(p.note || "");
    setEditError(null);
  }

  // Save edit modal
  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingPerson) return;

    setEditLoading(true);
    setEditError(null);

    try {
      const res = await fetch(
        `/api/admin/attendees/by-roll/${encodeURIComponent(editingPerson.roll_no)}/edit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            newRollNo: editRollNo,
            newName: editName,
            note: editNote,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || "Failed to save attendee changes.");
      } else {
        setActionMessage(data.message);
        setEditingPerson(null);
        fetchPersons();
      }
    } catch {
      setEditError("Network error saving changes.");
    } finally {
      setEditLoading(false);
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      {/* Add Attendee Form */}
      <AddAttendeeForm onAdded={fetchPersons} />

      {/* Main Table Card */}
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Registered Attendees</h2>
            <p className="text-xs text-slate-500">
              Grouped by person. Manage society status, edit information, or export download logs.
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

        {/* Global Feedback Banner */}
        {actionMessage && (
          <div className="rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200 flex justify-between items-center">
            <span>✓ {actionMessage}</span>
            <button
              onClick={() => setActionMessage(null)}
              className="text-emerald-600 hover:text-emerald-900 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 items-end">
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
              placeholder="Search by roll number, name, or cert ID..."
              className="block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
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
              <option value="downloaded">Downloaded (≥ 1 cert)</option>
              <option value="not_downloaded">Not Downloaded (0)</option>
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer pb-2.5">
              <input
                type="checkbox"
                checked={societyOnly}
                onChange={(e) => {
                  setSocietyOnly(e.target.checked);
                  setPage(1);
                }}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs font-semibold text-slate-700">Society members only</span>
            </label>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        )}

        {/* Grouped Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="max-h-[32rem] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-100 font-semibold text-slate-700 z-10">
                <tr>
                  <th className="px-4 py-2.5">Roll Number</th>
                  <th className="px-4 py-2.5">Full Name</th>
                  <th className="px-4 py-2.5 text-center">Society Member</th>
                  <th className="px-4 py-2.5 text-center">Participation</th>
                  <th className="px-4 py-2.5 text-center">Appreciation</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && persons.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      Loading attendees...
                    </td>
                  </tr>
                ) : persons.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No attendees match your filter criteria.
                    </td>
                  </tr>
                ) : (
                  persons.map((p) => {
                    const isToggling = togglingRoll === p.roll_no;
                    const isDeleting = deletingRoll === p.roll_no;

                    return (
                      <tr key={p.roll_no} className="hover:bg-slate-50 transition">
                        {/* Roll Number */}
                        <td className="px-4 py-3 font-mono font-bold text-slate-800">
                          {p.roll_no}
                          {p.source === "manual" && (
                            <span className="ml-1.5 rounded bg-slate-100 px-1 py-0.5 text-[9px] font-sans font-medium text-slate-500">
                              manual
                            </span>
                          )}
                        </td>

                        {/* Full Name */}
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-900">{p.name}</span>
                          {p.note && (
                            <p className="text-[10px] text-slate-500 italic mt-0.5">{p.note}</p>
                          )}
                        </td>

                        {/* Society Member Toggle */}
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleSocietyToggle(p)}
                            disabled={isToggling}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 ${
                              p.isSocietyMember ? "bg-indigo-600" : "bg-slate-200"
                            }`}
                            title={p.isSocietyMember ? "Click to revoke society membership" : "Click to grant society membership"}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                p.isSocietyMember ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </td>

                        {/* Participation Status */}
                        <td className="px-4 py-3 text-center">
                          {p.participation ? (
                            p.participation.download_count > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                ✓ Downloaded ({p.participation.download_count})
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                                Not downloaded
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400 font-mono">—</span>
                          )}
                        </td>

                        {/* Appreciation Status */}
                        <td className="px-4 py-3 text-center">
                          {p.isSocietyMember && p.appreciation ? (
                            p.appreciation.download_count > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800">
                                ✓ Downloaded ({p.appreciation.download_count})
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                                Not downloaded
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400 font-mono">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEdit(p)}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePerson(p)}
                              disabled={isDeleting}
                              className="rounded-lg border border-red-200 bg-red-50/50 px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100 transition disabled:opacity-50"
                            >
                              {isDeleting ? "..." : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between pt-2 text-xs text-slate-500">
          <span>
            Showing {persons.length} of {totalCount} attendees
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

      {/* Edit Modal */}
      {editingPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Edit Attendee Information
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Changes apply to all certificate records for this attendee without resetting download counts or certificate IDs.
              </p>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Roll Number *
                </label>
                <input
                  type="text"
                  required
                  value={editRollNo}
                  onChange={(e) => setEditRollNo(e.target.value)}
                  disabled={editLoading}
                  className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={editLoading}
                  className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Note
                </label>
                <input
                  type="text"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  disabled={editLoading}
                  placeholder="Optional internal remark"
                  className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              {editError && (
                <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700 ring-1 ring-red-200">
                  {editError}
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPerson(null)}
                  disabled={editLoading}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {editLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
