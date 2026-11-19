import "server-only";

import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ rollNo: string }> }
) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const { rollNo: currentRollParam } = await params;
  const rollNo = decodeURIComponent(currentRollParam || "").trim().toUpperCase();

  if (!rollNo) {
    return NextResponse.json({ error: "Missing roll number." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: rows, error: checkError } = await supabase
      .from("attendees")
      .select("id, name, cert_type, download_count")
      .eq("roll_no", rollNo);

    if (checkError) throw checkError;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "Attendee not found." }, { status: 404 });
    }

    const attendeeName = rows[0].name;

    const { error: delError } = await supabase.from("attendees").delete().eq("roll_no", rollNo);
    if (delError) throw delError;

    return NextResponse.json({
      ok: true,
      message: `Deleted all certificate records for ${attendeeName} (${rollNo}).`,
    });
  } catch (err) {
    console.error("Error deleting attendee by roll number:", err);
    return NextResponse.json({ error: "Failed to delete attendee records." }, { status: 500 });
  }
}
