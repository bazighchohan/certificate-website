import "server-only";

import { NextResponse } from "next/server";
import Papa from "papaparse";
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

interface SocietyCsvRow {
  rollNo: string;
  name?: string;
  rowNum: number;
}

function parseSocietyUpload(csvContent: string): {
  rows: SocietyCsvRow[];
  duplicates: string[];
} {
  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase().replace(/[\s_-]+/g, "_"),
  });

  const seen = new Set<string>();
  const duplicates: string[] = [];
  const rows: SocietyCsvRow[] = [];

  result.data.forEach((r, idx) => {
    const rollRaw = r["roll_no"] || r["rollno"] || r["roll"] || "";
    const nameRaw = r["name"] || r["full_name"] || r["fullname"] || "";
    const normRoll = normalizeRollNo(rollRaw);

    if (!normRoll) return;

    if (seen.has(normRoll)) {
      duplicates.push(normRoll);
    } else {
      seen.add(normRoll);
      rows.push({
        rollNo: normRoll,
        name: normalizeName(nameRaw) || undefined,
        rowNum: idx + 2,
      });
    }
  });

  return { rows, duplicates };
}

// 1. PREVIEW endpoint
export async function POST(req: Request) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data submission." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Please provide a valid CSV file." }, { status: 400 });
  }

  const content = await (file as File).text();
  if (!content.trim()) {
    return NextResponse.json({ error: "Uploaded CSV file is empty." }, { status: 400 });
  }

  const { rows, duplicates } = parseSocietyUpload(content);
  if (rows.length === 0) {
    return NextResponse.json({ error: "No roll numbers found in CSV." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const rollList = rows.map((r) => r.rollNo);

    // Fetch existing attendees matching these roll numbers
    const existingAttendeesMap = new Map<string, { name: string; hasAppreciation: boolean }>();

    const BATCH = 500;
    for (let i = 0; i < rollList.length; i += BATCH) {
      const chunk = rollList.slice(i, i + BATCH);
      const { data, error } = await supabase
        .from("attendees")
        .select("roll_no, name, cert_type")
        .in("roll_no", chunk);

      if (error) throw error;
      if (data) {
        data.forEach((item) => {
          const prev = existingAttendeesMap.get(item.roll_no);
          if (!prev) {
            existingAttendeesMap.set(item.roll_no, {
              name: item.name,
              hasAppreciation: item.cert_type === "appreciation",
            });
          } else if (item.cert_type === "appreciation") {
            prev.hasAppreciation = true;
          }
        });
      }
    }

    const matchedList: { rollNo: string; name: string; alreadyHasAppreciation: boolean }[] = [];
    const unmatchedList: { rollNo: string; name?: string }[] = [];

    rows.forEach((r) => {
      const match = existingAttendeesMap.get(r.rollNo);
      if (match) {
        matchedList.push({
          rollNo: r.rollNo,
          name: match.name,
          alreadyHasAppreciation: match.hasAppreciation,
        });
      } else {
        unmatchedList.push({
          rollNo: r.rollNo,
          name: r.name,
        });
      }
    });

    return NextResponse.json({
      totalInFile: rows.length,
      matchedCount: matchedList.length,
      unmatchedCount: unmatchedList.length,
      alreadyHasAppreciationCount: matchedList.filter((m) => m.alreadyHasAppreciation).length,
      duplicatesInFileCount: duplicates.length,
      matched: matchedList.slice(0, 200),
      unmatched: unmatchedList, // return all unmatched so admin can review
    });
  } catch (err) {
    console.error("Error previewing society CSV:", err);
    return NextResponse.json({ error: "Failed to process society CSV." }, { status: 500 });
  }
}

// 2. CONFIRM endpoint (PUT)
export async function PUT(req: Request) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form submission." }, { status: 400 });
  }

  const file = formData.get("file");
  const addUnmatched = formData.get("addUnmatched") === "true";

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Please provide a valid CSV file." }, { status: 400 });
  }

  const content = await (file as File).text();
  const { rows } = parseSocietyUpload(content);

  if (rows.length === 0) {
    return NextResponse.json({ error: "No roll numbers found in file." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const rollList = rows.map((r) => r.rollNo);

    // Fetch existing attendees
    const existingAttendeesMap = new Map<string, { name: string; hasAppreciation: boolean }>();
    const BATCH = 500;
    for (let i = 0; i < rollList.length; i += BATCH) {
      const chunk = rollList.slice(i, i + BATCH);
      const { data, error } = await supabase
        .from("attendees")
        .select("roll_no, name, cert_type")
        .in("roll_no", chunk);

      if (error) throw error;
      if (data) {
        data.forEach((item) => {
          const prev = existingAttendeesMap.get(item.roll_no);
          if (!prev) {
            existingAttendeesMap.set(item.roll_no, {
              name: item.name,
              hasAppreciation: item.cert_type === "appreciation",
            });
          } else if (item.cert_type === "appreciation") {
            prev.hasAppreciation = true;
          }
        });
      }
    }

    const rowsToInsert: {
      roll_no: string;
      name: string;
      cert_type: "participation" | "appreciation";
      cert_id: string;
      source: "manual" | "csv";
      note?: string | null;
    }[] = [];

    let appreciationCreatedCount = 0;
    let newAttendeesAddedCount = 0;

    rows.forEach((r) => {
      const match = existingAttendeesMap.get(r.rollNo);
      if (match) {
        // Person already exists. Add appreciation row if they don't have one yet
        if (!match.hasAppreciation) {
          appreciationCreatedCount++;
          rowsToInsert.push({
            roll_no: r.rollNo,
            name: match.name,
            cert_type: "appreciation",
            cert_id: generateCertId(),
            source: "manual",
            note: "Added via Society CSV sync",
          });
        }
      } else if (addUnmatched) {
        // Unmatched person, but admin ticked "Also add unmatched people as new attendees"
        // Requires a name
        if (r.name) {
          newAttendeesAddedCount++;
          // Add both participation and appreciation
          rowsToInsert.push({
            roll_no: r.rollNo,
            name: r.name,
            cert_type: "participation",
            cert_id: generateCertId(),
            source: "manual",
            note: "New attendee via Society CSV",
          });
          rowsToInsert.push({
            roll_no: r.rollNo,
            name: r.name,
            cert_type: "appreciation",
            cert_id: generateCertId(),
            source: "manual",
            note: "Society member via Society CSV",
          });
        }
      }
    });

    if (rowsToInsert.length > 0) {
      for (let i = 0; i < rowsToInsert.length; i += BATCH) {
        const chunk = rowsToInsert.slice(i, i + BATCH);
        const { error: insError } = await supabase.from("attendees").insert(chunk);
        if (insError) throw insError;
      }
    }

    return NextResponse.json({
      ok: true,
      appreciationCreatedCount,
      newAttendeesAddedCount,
      message: `Society sync completed: ${appreciationCreatedCount} appreciation certificates granted${
        newAttendeesAddedCount > 0 ? `, and ${newAttendeesAddedCount} new attendees registered` : ""
      }.`,
    });
  } catch (err) {
    console.error("Error confirming society CSV sync:", err);
    return NextResponse.json(
      { error: "Failed to save society sync changes to database." },
      { status: 500 }
    );
  }
}
