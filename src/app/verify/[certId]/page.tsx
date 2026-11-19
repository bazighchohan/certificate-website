import "server-only";

import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase";
import { CERT_LABELS, type CertType } from "@/lib/cert-types";
import { SEMINAR_TITLE, SEMINAR_SUBTITLE } from "@/lib/config";

export const dynamic = "force-dynamic";

interface VerifyPageProps {
  params: Promise<{ certId: string }>;
}

export default async function VerifyCertificatePage({ params }: VerifyPageProps) {
  const { certId } = await params;
  const normalizedCertId = (certId || "").trim().toUpperCase();

  if (!normalizedCertId || normalizedCertId.length > 64) {
    return <InvalidCertificateView reason="Malformed certificate ID" />;
  }

  interface AttendeeVerifyRecord {
    name: string;
    roll_no: string;
    cert_type: CertType;
    cert_id: string;
    created_at: string;
  }

  let attendee: AttendeeVerifyRecord | null = null;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("attendees")
      .select("name, roll_no, cert_type, cert_id, created_at")
      .eq("cert_id", normalizedCertId)
      .maybeSingle();

    if (error) {
      console.error("Supabase lookup error during verification:", error);
    } else if (data) {
      attendee = data as unknown as AttendeeVerifyRecord;
    }
  } catch (err) {
    console.error("Database connection failure in verification:", err);
  }

  if (!attendee) {
    return <InvalidCertificateView reason="Certificate record not found in our registry." />;
  }

  const certTypeLabel = CERT_LABELS[attendee.cert_type] || attendee.cert_type;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Verification Card */}
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          {/* Header Banner */}
          <div className="bg-emerald-600 px-6 py-6 text-center text-white">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-2xl shadow-inner backdrop-blur-sm">
              ✓
            </div>
            <h1 className="text-xl font-bold tracking-tight">Valid Certificate</h1>
            <p className="mt-0.5 text-xs text-emerald-100">
              Verified by Official Event Records
            </p>
          </div>

          {/* Details Body */}
          <div className="p-6 space-y-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Attendee Name
                </span>
                <p className="text-base font-bold text-slate-900">{attendee.name}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Roll Number
                  </span>
                  <p className="font-mono text-sm font-semibold text-slate-800">
                    {attendee.roll_no}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Certificate Type
                  </span>
                  <p className="text-sm font-semibold text-indigo-700">
                    {certTypeLabel}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Seminar / Event
                </span>
                <p className="text-sm font-medium text-slate-800">{SEMINAR_TITLE}</p>
                <p className="text-xs text-slate-500">{SEMINAR_SUBTITLE}</p>
              </div>

              <div className="pt-2 border-t border-slate-200/60">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Certificate Reference ID
                </span>
                <p className="font-mono text-xs text-slate-600">{attendee.cert_id}</p>
              </div>
            </div>

            <div className="pt-2 text-center">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
              >
                ← Go to Certificate Download Portal
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function InvalidCertificateView({ reason }: { reason: string }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-12">
      <div className="w-full max-w-md">
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="bg-red-600 px-6 py-6 text-center text-white">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-2xl shadow-inner backdrop-blur-sm">
              ✕
            </div>
            <h1 className="text-xl font-bold tracking-tight">Invalid Certificate</h1>
            <p className="mt-0.5 text-xs text-red-100">Verification Failed</p>
          </div>

          <div className="p-6 text-center space-y-4">
            <div className="rounded-xl border border-red-100 bg-red-50/50 p-4">
              <p className="text-sm font-semibold text-red-800">
                We could not verify the authenticity of this certificate.
              </p>
              <p className="mt-1 text-xs text-red-600">{reason}</p>
            </div>

            <p className="text-xs text-slate-500">
              If you believe this is in error, please contact the event administrators with your original certificate details.
            </p>

            <div className="pt-2">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
              >
                ← Go to Portal Homepage
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
