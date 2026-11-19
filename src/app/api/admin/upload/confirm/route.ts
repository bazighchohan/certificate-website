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
    return NextResponse.json({ error: "Invalid form submission." }, { status: 400 });
  }

  const file = formData.get("file");
  const purgeMissing = formData.get("purgeMissing") === "true";

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Please provide a valid CSV file." }, { status: 400 });
  }

  const csvFile = file as File;
  const content = await csvFile.text();
  if (!content.trim()) {
    return NextResponse.json({ error: "The uploaded file is empty." }, { status: 400 });
  }

  const { validList } = parseUnifiedCsv(content);
  if (validList.length === 0) {
    return NextResponse.json({ error: "No valid rows found to import." }, { status: 400 });
  }

  // Build target list of rows to upsert:
  // 1. Every attendee gets a 'participation' row
  // 2. Society members also get an 'appreciation' row
  type TargetItem = { roll_no: string; name: string; cert_type: "participation" | "appreciation" };
  const targetItems: TargetItem[] = [];
  const validRolls = new Set<string>();

  validList.forEach((r) => {
    validRolls.add(r.normalizedRollNo);
    targetItems.push({
      roll_no: r.normalizedRollNo,
      name: r.normalizedName,
      cert_type: "participation",
    });
    if (r.isSocietyMember) {
      targetItems.push({
        roll_no: r.normalizedRollNo,
        name: r.normalizedName,
        cert_type: "appreciation",
      });
    }
  });

  try {
    const supabase = getSupabaseAdmin();

    // 1. Fetch existing cert_id for (roll_no, cert_type) pairs to preserve them
    const allRollList = Array.from(validRolls);
    const existingMap = new Map<string, string>(); // `${roll_no}:${cert_type}` -> cert_id

    const QUERY_BATCH = 500;
    for (let i = 0; i < allRollList.length; i += QUERY_BATCH) {
      const batch = allRollList.slice(i, i + QUERY_BATCH);
      const { data, error } = await supabase
        .from("attendees")
        .select("roll_no, cert_type, cert_id")
        .in("roll_no", batch);
      if (error) throw error;
      if (data) {
        data.forEach((r) => existingMap.set(`${r.roll_no}:${r.cert_type}`, r.cert_id));
      }
    }

    let insertedCount = 0;
    let updatedCount = 0;

    const rowsToUpsert = targetItems.map((item) => {
      const key = `${item.roll_no}:${item.cert_type}`;
      const existingCertId = existingMap.get(key);
      const isExisting = !!existingCertId;

      if (isExisting) {
        updatedCount++;
      } else {
        insertedCount++;
      }

      const certId =
        existingCertId ||
        Math.random().toString(36).substring(2, 10).toUpperCase() +
          Date.now().toString(36).slice(-4).toUpperCase();

      return {
        roll_no: item.roll_no,
        name: item.name,
        cert_type: item.cert_type,
        cert_id: certId,
      };
    });

    // 2. Batch upsert into attendees
    const UPSERT_BATCH = 500;
    for (let i = 0; i < rowsToUpsert.length; i += UPSERT_BATCH) {
      const chunk = rowsToUpsert.slice(i, i + UPSERT_BATCH);
      const { error: upsertError } = await supabase.from("attendees").upsert(chunk, {
        onConflict: "roll_no,cert_type",
        ignoreDuplicates: false,
      });
      if (upsertError) throw upsertError;
    }

    // 3. Optional: "remove rows not in this file"
    let deletedCount = 0;
    if (purgeMissing && allRollList.length > 0) {
      // Delete rows whose roll_no is not in allRollList
      // Or if society member was revoked, handle appreciation if requested?
      // "remove rows not in this file": standard is removing attendees whose roll_no is not present in this file.
      // Additionally, delete any appreciation row if roll_no is in the file but NOT marked as society member.
      const societyMemberRolls = new Set(
        validList.filter((r) => r.isSocietyMember).map((r) => r.normalizedRollNo)
      );

      // (A) Delete all attendees not in the file's roll list
      // In Supabase / PostgREST, we can do `.not("roll_no", "in", (allRollList))`
      // For safety with large sets, chunk deletions if necessary or execute filter:
      const { data: allDbRows, error: fetchAllError } = await supabase
        .from("attendees")
        .select("id, roll_no, cert_type");

      if (fetchAllError) throw fetchAllError;

      const idsToDelete: string[] = [];
      if (allDbRows) {
        allDbRows.forEach((r) => {
          if (!validRolls.has(r.roll_no)) {
            // Not in file at all
            idsToDelete.push(r.id);
          } else if (r.cert_type === "appreciation" && !societyMemberRolls.has(r.roll_no)) {
            // In file, but not a society member anymore
            idsToDelete.push(r.id);
          }
        });
      }

      if (idsToDelete.length > 0) {
        const DELETE_BATCH = 500;
        for (let i = 0; i < idsToDelete.length; i += DELETE_BATCH) {
          const batch = idsToDelete.slice(i, i + DELETE_BATCH);
          const { error: delError } = await supabase
            .from("attendees")
            .delete()
            .in("id", batch);
          if (delError) throw delError;
        }
        deletedCount = idsToDelete.length;
      }
    }

    return NextResponse.json({
      ok: true,
      validAttendees: validList.length,
      totalCertificatesProcessed: rowsToUpsert.length,
      inserted: insertedCount,
      updated: updatedCount,
      deleted: deletedCount,
      message: `Processed ${validList.length} attendees (${insertedCount} new certificate records, ${updatedCount} updated${
        deletedCount > 0 ? `, ${deletedCount} pruned` : ""
      }).`,
    });
  } catch (err) {
    console.error("Error upserting attendees:", err);
    return NextResponse.json(
      { error: "Database operation failed. Check Supabase connection and schema." },
      { status: 500 }
    );
  }
}
