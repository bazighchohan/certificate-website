import "server-only";

import { NextResponse } from "next/server";
import Papa from "papaparse";
import { requireAdminApi } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;

  try {
    const supabase = getSupabaseAdmin();
    // Only fetch attendees who have downloaded at least once
    const { data, error } = await supabase
      .from("attendees")
      .select("roll_no, name, cert_type, cert_id, download_count, created_at")
      .gt("download_count", 0)
      .order("download_count", { ascending: false });

    if (error) throw error;

    const rows = (data || []).map((r) => ({
      roll_no: r.roll_no,
      name: r.name,
      cert_type: r.cert_type,
      cert_id: r.cert_id,
      download_count: r.download_count,
      created_at: r.created_at,
    }));

    const csv = Papa.unparse(rows);
    const filename = `downloaded_attendees_${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Error exporting downloaded attendees:", err);
    return NextResponse.json(
      { error: "Failed to export downloaded attendees." },
      { status: 500 }
    );
  }
}
