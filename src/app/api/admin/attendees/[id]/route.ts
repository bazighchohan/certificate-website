import "server-only";

import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing attendee ID." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("attendees").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true, id, message: "Attendee deleted successfully." });
  } catch (err) {
    console.error("Error deleting attendee:", err);
    return NextResponse.json({ error: "Failed to delete attendee." }, { status: 500 });
  }
}
