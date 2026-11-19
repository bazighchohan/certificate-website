import "server-only";

import Papa from "papaparse";

export interface ParsedCsvRow {
  rowNum: number;
  rollNo: string;
  name: string;
  normalizedRollNo: string;
  normalizedName: string;
  isSocietyMember: boolean;
  error?: string;
}

export function normalizeRollNo(v: string): string {
  return (v || "").trim().toUpperCase();
}

export function normalizeName(v: string): string {
  return (v || "").trim().replace(/\s+/g, " ");
}

export function parseSocietyMember(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (!v || typeof v !== "string") return false;
  const val = v.trim().toLowerCase();
  return val === "yes" || val === "y" || val === "true" || val === "1";
}

export function parseUnifiedCsv(csvContent: string): {
  parsedRows: ParsedCsvRow[];
  duplicates: Set<number>;
  validList: ParsedCsvRow[];
  societyMemberCount: number;
  errors: string[];
} {
  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase().replace(/[\s_-]+/g, "_"),
  });

  const errors: string[] = [];
  if (result.errors && result.errors.length > 0) {
    for (const err of result.errors.slice(0, 5)) {
      errors.push(`Row ${err.row ?? "unknown"}: ${err.message}`);
    }
  }

  const parsedRows: ParsedCsvRow[] = [];
  const seenRolls = new Map<string, number>(); // roll -> rowNum
  const duplicates = new Set<number>();
  const validList: ParsedCsvRow[] = [];
  let societyMemberCount = 0;

  result.data.forEach((row, idx) => {
    const rowNum = idx + 2; // header is row 1
    const rollRaw = row["roll_no"] || row["rollno"] || row["roll"] || "";
    const nameRaw = row["name"] || row["full_name"] || row["fullname"] || "";
    const memberRaw =
      row["is_society_member"] ??
      row["society_member"] ??
      row["member"] ??
      row["is_member"] ??
      "";

    const normRoll = normalizeRollNo(rollRaw);
    const normName = normalizeName(nameRaw);
    const isMember = parseSocietyMember(memberRaw);

    if (!normRoll && !normName) {
      return; // Skip blank line
    }

    let rowError: string | undefined;
    if (!normRoll) {
      rowError = "Missing roll_no";
    } else if (!normName) {
      rowError = "Missing name";
    } else if (normRoll.length > 50) {
      rowError = "roll_no exceeds 50 characters";
    } else if (normName.length > 120) {
      rowError = "name exceeds 120 characters";
    }

    const item: ParsedCsvRow = {
      rowNum,
      rollNo: rollRaw.trim(),
      name: normName,
      normalizedRollNo: normRoll,
      normalizedName: normName,
      isSocietyMember: isMember,
      error: rowError,
    };

    if (rowError) {
      parsedRows.push(item);
      return;
    }

    // Check duplicate in file
    if (seenRolls.has(normRoll)) {
      const prevRow = seenRolls.get(normRoll)!;
      item.error = `Duplicate roll_no in file (previously on row ${prevRow})`;
      duplicates.add(rowNum);
      parsedRows.push(item);
    } else {
      seenRolls.set(normRoll, rowNum);
      if (isMember) {
        societyMemberCount++;
      }
      parsedRows.push(item);
      validList.push(item);
    }
  });

  return { parsedRows, duplicates, validList, societyMemberCount, errors };
}
