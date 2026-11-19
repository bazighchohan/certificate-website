import "server-only";

import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const normalizeRollNo = (v: string) => (v || "").trim().toUpperCase();
const normalizeName = (v: string) => (v || "").trim().replace(/\s+/g, " ");

export async function POST(
  req: Request,
  { params }: { params: Promise<{ rollNo: string }> }
) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const { rollNo: currentRollParam } = await params;
  const currentRoll = decodeURIComponent(currentRollParam || "").trim().toUpperCase();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON input." }, { status: 400 });
  }

  const { newRollNo, newName, note } = (body ?? {}) as {
    newRollNo?: unknown;
    newName?: unknown;
    note?: unknown;
  };

  if (typeof newRollNo !== "string" || typeof newName !== "string") {
    return NextResponse.json({ error: "New roll number and name are required." }, { status: 400 });
  }

  const normNewRoll = normalizeRollNo(newRollNo);
  const normNewName = normalizeName(newName);
  const noteStr = typeof note === "string" ? note.trim() : undefined;

  if (!normNewRoll || !normNewName) {
    return NextResponse.json({ error: "Roll number and name cannot be empty." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // 1. Verify current attendee exists
    const { data: currentRows, error: findError } = await supabase
      .from("attendees")
      .select("id, roll_no")
      .eq("roll_no", currentRoll);

    if (findError) throw findError;
    if (!currentRows || currentRows.length === 0) {
      return NextResponse.json({ error: "Attendee not found." }, { status: 404 });
    }

    // 2. If roll_no is changing, ensure new roll_no doesn't already belong to someone else
    if (normNewRoll !== currentRoll) {
      const { data: collision, error: colError } = await supabase
        .from("attendees")
        .select("id, roll_no")
        .eq("roll_no", normNewRoll);

      if (colError) throw colError;
      if (collision && collision.length > 0) {
        return NextResponse.json(
          { error: `The roll number ${normNewRoll} already belongs to another attendee.` },
          { status: 409 }
        );
      }
    }

    // 3. Update all rows for that person without touching cert_id or download_count
    const updatePayload: { roll_no: string; name: string; note?: string | null } = {
      roll_no: normNewRoll,
      name: normNewName,
    };
    if (noteStr !== undefined) {
      updatePayload.note = noteStr || null;
    }

    const { error: updateError } = await supabase
      .from("attendees")
      .update(updatePayload)
      .eq("roll_no", currentRoll);

    if (updateError) throw updateError;

    return NextResponse.json({
      ok: true,
      message: `Updated attendee successfully to ${normNewName} (${normNewRoll}).`,
    });
  } catch (err) {
    console.error("Error editing attendee:", err);
    return NextResponse.json(
      { error: "Failed to update attendee. Check database constraints." },
      { status: 500 }
    );
  }
}
