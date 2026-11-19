import "server-only";

import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { parseUnifiedCsv } from "@/lib/csv-parser";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const csvFile = file as File;
  const content = await csvFile.text();
  if (!content.trim()) {
    return NextResponse.json({ error: "The uploaded file is empty." }, { status: 400 });
  }

  const { parsedRows, duplicates, validList, societyMemberCount, errors } = parseUnifiedCsv(content);

  if (parsedRows.length === 0) {
    return NextResponse.json({ error: "No data rows found in CSV." }, { status: 400 });
  }

  // Determine existing rows in the DB:
  // For each valid row:
  // - always generates participation
  // - if isSocietyMember, also generates appreciation
  // We query attendees table for any existing (roll_no, cert_type)
  const allRolls = validList.map((r) => r.normalizedRollNo);
  const existingSet = new Set<string>(); // key: `${roll_no}:${cert_type}`

  if (allRolls.length > 0) {
    try {
      const supabase = getSupabaseAdmin();
      const BATCH_SIZE = 500;
      for (let i = 0; i < allRolls.length; i += BATCH_SIZE) {
        const batch = allRolls.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabase
          .from("attendees")
          .select("roll_no, cert_type")
          .in("roll_no", batch);

        if (error) throw error;
        if (data) {
          data.forEach((row) => existingSet.add(`${row.roll_no}:${row.cert_type}`));
        }
      }
    } catch (err) {
      console.error("Error querying existing attendees in DB:", err);
      return NextResponse.json(
        { error: "Failed to verify existing attendees with database." },
        { status: 500 }
      );
    }
  }

  let totalTargetRows = 0;
  let newRowsCount = 0;
  let existingRowsCount = 0;

  // Calculate certificate rows to be created/updated
  validList.forEach((r) => {
    // 1. participation
    totalTargetRows++;
    if (existingSet.has(`${r.normalizedRollNo}:participation`)) {
      existingRowsCount++;
    } else {
      newRowsCount++;
    }

    // 2. appreciation (if society member)
    if (r.isSocietyMember) {
      totalTargetRows++;
      if (existingSet.has(`${r.normalizedRollNo}:appreciation`)) {
        existingRowsCount++;
      } else {
        newRowsCount++;
      }
    }
  });

  const previewRows = parsedRows.map((r) => {
    if (r.error) {
      return {
        rowNum: r.rowNum,
        rollNo: r.rollNo,
        name: r.name,
        isSocietyMember: r.isSocietyMember,
        status: duplicates.has(r.rowNum) ? ("duplicate" as const) : ("invalid" as const),
        error: r.error,
      };
    }

    const partExists = existingSet.has(`${r.normalizedRollNo}:participation`);
    const appExists = r.isSocietyMember && existingSet.has(`${r.normalizedRollNo}:appreciation`);

    return {
      rowNum: r.rowNum,
      rollNo: r.normalizedRollNo,
      name: r.normalizedName,
      isSocietyMember: r.isSocietyMember,
      status: (!partExists && (!r.isSocietyMember || !appExists)) ? ("new" as const) : ("existing" as const),
      details: {
        participation: partExists ? "Existing (Update)" : "New (+Cert ID)",
        appreciation: r.isSocietyMember
          ? appExists
            ? "Existing (Update)"
            : "New (+Cert ID)"
          : "N/A",
      },
    };
  });

  return NextResponse.json({
    totalCsvRows: parsedRows.length,
    validAttendees: validList.length,
    invalidRows: parsedRows.length - validList.length - duplicates.size,
    duplicateRows: duplicates.size,
    societyMembers: societyMemberCount,
    totalTargetCertRows: totalTargetRows,
    newCertRows: newRowsCount,
    existingCertRows: existingRowsCount,
    rows: previewRows.slice(0, 500),
    hasMoreRows: previewRows.length > 500,
    errors,
  });
}
