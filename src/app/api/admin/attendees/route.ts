import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const { searchParams } = req.nextUrl;
  const search = (searchParams.get("search") || "").trim();
  const certType = (searchParams.get("certType") || "").trim();
  const downloadFilter = (searchParams.get("downloadFilter") || "").trim(); // "downloaded" | "not_downloaded" | "all"
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(10, parseInt(searchParams.get("pageSize") || "50", 10)));

  try {
    const supabase = getSupabaseAdmin();
    let query = supabase.from("attendees").select("*", { count: "exact" });

    if (certType && (certType === "participation" || certType === "appreciation")) {
      query = query.eq("cert_type", certType);
    }

    if (downloadFilter === "downloaded") {
      query = query.gt("download_count", 0);
    } else if (downloadFilter === "not_downloaded") {
      query = query.eq("download_count", 0);
    }

    if (search) {
      // Search by roll_no or name (case-insensitive substring)
      query = query.or(`roll_no.ilike.%${search}%,name.ilike.%${search}%,cert_id.ilike.%${search}%`);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    query = query.order("created_at", { ascending: false }).range(from, to);

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      attendees: data ?? [],
      totalCount: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    });
  } catch (err) {
    console.error("Error fetching attendees:", err);
    return NextResponse.json({ error: "Failed to load attendees." }, { status: 500 });
  }
}
