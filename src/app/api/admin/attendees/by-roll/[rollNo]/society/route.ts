import "server-only";

import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function generateCertId(): string {
  return (
    Math.random().toString(36).substring(2, 10).toUpperCase() +
    Date.now().toString(36).slice(-4).toUpperCase()
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ rollNo: string }> }
) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const { rollNo: currentRollParam } = await params;
  const rollNo = decodeURIComponent(currentRollParam || "").trim().toUpperCase();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON input." }, { status: 400 });
  }

  const { enable } = (body ?? {}) as { enable?: unknown };
  if (typeof enable !== "boolean") {
    return NextResponse.json({ error: "Field 'enable' must be boolean." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Check existing attendee records for this roll_no
    const { data: rows, error: fetchError } = await supabase
      .from("attendees")
      .select("id, roll_no, name, cert_type, download_count, source, note")
      .eq("roll_no", rollNo);

    if (fetchError) throw fetchError;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "Attendee does not exist." }, { status: 404 });
    }

    const attendeeName = rows[0].name;
    const existingAppreciation = rows.find((r) => r.cert_type === "appreciation");

    if (enable) {
      // Switching ON: Upsert appreciation row with new random cert_id if not present
      if (existingAppreciation) {
        return NextResponse.json({
          ok: true,
          message: `${attendeeName} is already a society member.`,
        });
      }

      const { error: insertError } = await supabase.from("attendees").insert({
        roll_no: rollNo,
        name: attendeeName,
        cert_type: "appreciation",
        cert_id: generateCertId(),
        source: rows[0].source || "manual",
        note: rows[0].note || null,
        download_count: 0,
      });

      if (insertError) throw insertError;

      return NextResponse.json({
        ok: true,
        isSocietyMember: true,
        message: `Appreciation certificate enabled for ${attendeeName} (${rollNo}).`,
      });
    } else {
      // Switching OFF: Delete appreciation row
      if (!existingAppreciation) {
        return NextResponse.json({
          ok: true,
          message: `${attendeeName} was not a society member.`,
        });
      }

      const { error: deleteError } = await supabase
        .from("attendees")
        .delete()
        .eq("id", existingAppreciation.id);

      if (deleteError) throw deleteError;

      return NextResponse.json({
        ok: true,
        isSocietyMember: false,
        message: `Appreciation certificate removed for ${attendeeName} (${rollNo}).`,
      });
    }
  } catch (err) {
    console.error("Error toggling society member:", err);
    return NextResponse.json(
      { error: "Failed to update society member status." },
      { status: 500 }
    );
  }
}
