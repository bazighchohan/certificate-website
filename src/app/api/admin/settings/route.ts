import "server-only";

import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("settings")
      .select("released")
      .eq("id", true)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ released: data?.released === true });
  } catch (err) {
    console.error("Error fetching release setting:", err);
    return NextResponse.json(
      { error: "Failed to fetch release setting." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { released } = (body ?? {}) as { released?: unknown };
  if (typeof released !== "boolean") {
    return NextResponse.json(
      { error: "Field 'released' must be a boolean." },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("settings")
      .upsert({ id: true, released }, { onConflict: "id" });

    if (error) throw error;
    return NextResponse.json({ ok: true, released });
  } catch (err) {
    console.error("Error updating release setting:", err);
    return NextResponse.json(
      { error: "Failed to update release status." },
      { status: 500 }
    );
  }
}
