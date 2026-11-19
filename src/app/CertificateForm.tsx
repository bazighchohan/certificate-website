"use client";

import { useState, type FormEvent } from "react";

import { CERT_LABELS, type CertType } from "@/lib/cert-types";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string }
  | { kind: "not-released" }
  | { kind: "choose"; options: CertType[] };

/**
 * API contract for POST /api/certificate
 *   body: { rollNo: string, name: string, certType?: CertType }
 *   200  application/pdf (Content-Disposition: attachment; filename="...")
 *   4xx/5xx JSON { error?: string, code?: string, options?: CertType[] }
 *     code "NOT_RELEASED" -> certificates not released yet
 *     code "CHOOSE_TYPE"  -> attendee has several certificates; resend with certType
 */
const FRIENDLY: Record<number, string> = {
  400: "Please check your roll number and name and try again.",
  404: "We couldn’t find a certificate for that roll number and name. Please check the spelling and try again.",
  429: "Too many attempts. Please wait a minute and try again.",
};
const GENERIC_ERROR = "Something went wrong on our side. Please try again in a moment.";

const LABELS = CERT_LABELS;

export default function CertificateForm() {
  const [rollNo, setRollNo] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const loading = status.kind === "loading";

  async function request(certType?: CertType) {
    const roll = rollNo.trim();
    const fullName = name.trim().replace(/\s+/g, " ");
    if (!roll || !fullName) {
      setStatus({ kind: "error", message: "Please enter both your roll number and full name." });
      return;
    }

    setStatus({ kind: "loading" });
    try {
      const res = await fetch("/api/certificate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rollNo: roll, name: fullName, ...(certType && { certType }) }),
      });

      const type = res.headers.get("content-type") ?? "";
      if (res.ok && type.includes("application/pdf")) {
        const blob = await res.blob();
        downloadBlob(blob, filenameFrom(res.headers.get("content-disposition")) ?? "certificate.pdf");
        setStatus({ kind: "success", message: "Your certificate has been downloaded." });
        return;
      }

      const data: { error?: string; code?: string; options?: CertType[] } = type.includes("application/json")
        ? await res.json().catch(() => ({}))
        : {};

      if (data.code === "NOT_RELEASED") {
        setStatus({ kind: "not-released" });
      } else if (data.code === "CHOOSE_TYPE" && data.options?.length) {
        setStatus({ kind: "choose", options: data.options });
      } else {
        setStatus({
          kind: "error",
          message: data.error || FRIENDLY[res.status] || GENERIC_ERROR,
        });
      }
    } catch {
      setStatus({
        kind: "error",
        message: "We couldn’t reach the server. Please check your internet connection and try again.",
      });
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!loading) void request();
  }

  if (status.kind === "not-released") {
    return (
      <div className="py-6 text-center" role="status">
        <p className="text-lg font-semibold text-slate-900">Certificates will be available soon.</p>
        <p className="mt-2 text-sm text-slate-600">Please check back later.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div>
        <label htmlFor="rollNo" className="mb-1.5 block text-sm font-medium text-slate-700">
          Roll Number
        </label>
        <input
          id="rollNo"
          name="rollNo"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          required
          maxLength={50}
          value={rollNo}
          onChange={(e) => setRollNo(e.target.value)}
          disabled={loading}
          placeholder="e.g. 21CS045"
          className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:bg-slate-50"
        />
      </div>

      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-slate-700">
          Full Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          autoCapitalize="words"
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
          placeholder="As registered for the seminar"
          className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:bg-slate-50"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? (
          <>
            <Spinner />
            Checking…
          </>
        ) : (
          "Check & Download"
        )}
      </button>

      <div aria-live="polite">
        {status.kind === "error" && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
            {status.message}
          </p>
        )}
        {status.kind === "success" && (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ring-1 ring-emerald-200">
            {status.message}
          </p>
        )}
        {status.kind === "choose" && (
          <div className="space-y-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <p className="text-sm text-slate-700">You have more than one certificate. Which one would you like?</p>
            {status.options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => void request(opt)}
                className="block w-full rounded-lg bg-white px-4 py-3 text-left text-sm font-medium text-indigo-700 ring-1 ring-slate-200 transition hover:bg-indigo-50"
              >
                {LABELS[opt] ?? opt}
              </button>
            ))}
          </div>
        )}
      </div>
    </form>
  );
}

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
  );
}

function filenameFrom(disposition: string | null): string | null {
  if (!disposition) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (star) return decodeURIComponent(star[1]);
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain ? plain[1] : null;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
