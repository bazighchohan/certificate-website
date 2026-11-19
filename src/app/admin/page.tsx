import "server-only";

import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { getReleased } from "@/lib/supabase";
import AdminUploadClient from "./AdminUploadClient";
import ReleaseToggle from "./ReleaseToggle";
import AttendeesManager from "./AttendeesManager";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  let released = false;
  try {
    released = await getReleased();
  } catch (err) {
    console.error("Failed to read released setting in admin dashboard:", err);
  }

  return (
    <main className="min-h-dvh bg-slate-50 text-slate-900 pb-16">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white shadow-sm">
              📜
            </span>
            <div>
              <h1 className="text-base font-bold text-slate-900 sm:text-lg">Certificate Manager</h1>
              <p className="text-xs text-slate-500">Attendee CSV Import & Sync</p>
            </div>
          </div>
          <form action="/api/admin/logout" method="POST">
            <button
              type="submit"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Sign Out
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-8">
        {/* Release / Hide Toggle */}
        <ReleaseToggle initialReleased={released} />

        {/* Upload & Sync Section */}
        <AdminUploadClient />

        {/* Registered Attendees Table, Search, Filters & CSV Export */}
        <AttendeesManager />
      </div>
    </main>
  );
}
