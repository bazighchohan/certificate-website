import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET(req: NextRequest) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const { searchParams } = req.nextUrl;
  const search = (searchParams.get("search") || "").trim().toUpperCase();
  const downloadFilter = (searchParams.get("downloadFilter") || "").trim(); // "downloaded" | "not_downloaded"
  const societyOnly = searchParams.get("societyOnly") === "true";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(10, parseInt(searchParams.get("pageSize") || "25", 10)));

  try {
    const supabase = getSupabaseAdmin();
    // Query attendees table
    let query = supabase
      .from("attendees")
      .select("id, roll_no, name, cert_type, cert_id, download_count, source, note, created_at")
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(`roll_no.ilike.%${search}%,name.ilike.%${search}%,cert_id.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = data || [];

    // Group rows by roll_no
    const groupMap = new Map<string, AttendeePersonGroup>();

    rows.forEach((r) => {
      let g = groupMap.get(r.roll_no);
      if (!g) {
        g = {
          roll_no: r.roll_no,
          name: r.name,
          source: (r.source as "csv" | "manual") || "csv",
          note: r.note || null,
          isSocietyMember: false,
          participation: null,
          appreciation: null,
        };
        groupMap.set(r.roll_no, g);
      }

      const certSummary = {
        id: r.id,
        cert_id: r.cert_id,
        download_count: r.download_count,
        created_at: r.created_at,
      };

      if (r.cert_type === "participation") {
        g.participation = certSummary;
      } else if (r.cert_type === "appreciation") {
        g.appreciation = certSummary;
        g.isSocietyMember = true;
      }
    });

    let groupedList = Array.from(groupMap.values());

    // Apply society filter
    if (societyOnly) {
      groupedList = groupedList.filter((g) => g.isSocietyMember);
    }

    // Apply download status filter
    if (downloadFilter === "downloaded") {
      groupedList = groupedList.filter(
        (g) => (g.participation?.download_count ?? 0) > 0 || (g.appreciation?.download_count ?? 0) > 0
      );
    } else if (downloadFilter === "not_downloaded") {
      groupedList = groupedList.filter(
        (g) => (g.participation?.download_count ?? 0) === 0 && (g.appreciation?.download_count ?? 0) === 0
      );
    }

    const totalCount = groupedList.length;
    const from = (page - 1) * pageSize;
    const paginated = groupedList.slice(from, from + pageSize);

    return NextResponse.json({
      persons: paginated,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    });
  } catch (err) {
    console.error("Error fetching grouped attendees:", err);
    return NextResponse.json({ error: "Failed to load attendees." }, { status: 500 });
  }
}
