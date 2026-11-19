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

const normalizeRollNo = (v: string) => (v || "").trim().toUpperCase();
const normalizeName = (v: string) => (v || "").trim().replace(/\s+/g, " ");

export async function POST(req: Request) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON input." }, { status: 400 });
  }

  const { rollNo, name, isSocietyMember, note } = (body ?? {}) as {
    rollNo?: unknown;
    name?: unknown;
    isSocietyMember?: unknown;
    note?: unknown;
  };

  if (typeof rollNo !== "string" || typeof name !== "string") {
    return NextResponse.json({ error: "Roll number and name are required." }, { status: 400 });
  }

  const normRoll = normalizeRollNo(rollNo);
  const normName = normalizeName(name);
  const isMember = Boolean(isSocietyMember);
  const noteStr = typeof note === "string" && note.trim() ? note.trim() : null;

  if (!normRoll || !normName) {
    return NextResponse.json({ error: "Please enter both roll number and name." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Check if roll number already exists
    const { data: existing, error: checkError } = await supabase
      .from("attendees")
      .select("id, roll_no")
      .eq("roll_no", normRoll);

    if (checkError) throw checkError;

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "Already exists: an attendee with this roll number is already registered." },
        { status: 409 }
      );
    }

    // Insert participation row (and optional appreciation row)
    const rowsToInsert: {
      roll_no: string;
      name: string;
      cert_type: "participation" | "appreciation";
      cert_id: string;
      source: "manual";
      note: string | null;
    }[] = [
      {
        roll_no: normRoll,
        name: normName,
        cert_type: "participation",
        cert_id: generateCertId(),
        source: "manual",
        note: noteStr,
      },
    ];

    // If society member, also insert appreciation row
    if (isMember) {
      rowsToInsert.push({
        roll_no: normRoll,
        name: normName,
        cert_type: "appreciation",
        cert_id: generateCertId(),
        source: "manual",
        note: noteStr,
      });
    }

    const { error: insertError } = await supabase.from("attendees").insert(rowsToInsert);
    if (insertError) throw insertError;

    return NextResponse.json({
      ok: true,
      message: `Attendee ${normName} (${normRoll}) added successfully${
        isMember ? " with both Participation and Appreciation certificates" : ""
      }.`,
    });
  } catch (err) {
    console.error("Error adding attendee manually:", err);
    return NextResponse.json(
      { error: "Failed to add attendee. Please check database connectivity." },
      { status: 500 }
    );
  }
}
