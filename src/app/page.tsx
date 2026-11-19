import CertificateForm from "./CertificateForm";
import { SEMINAR_SUBTITLE, SEMINAR_TITLE } from "@/lib/config";
import { getReleased } from "@/lib/supabase";

// Release status can change at any time — always render on request.
export const dynamic = "force-dynamic";

export default async function Home() {
  // Checked on the server only. If the check fails (e.g. DB unreachable),
  // fall back to showing the form; the API enforces the release flag anyway.
  let released = true;
  try {
    released = await getReleased();
  } catch (err) {
    console.error("Failed to read release status:", err);
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10">
      <div className="w-full max-w-md">
        <header className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
            {SEMINAR_SUBTITLE}
          </p>
          <h1 className="mt-2 text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">
            {SEMINAR_TITLE}
          </h1>
        </header>

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          {released ? (
            <CertificateForm />
          ) : (
            <ComingSoon />
          )}
        </section>

        <footer className="mt-6 text-center text-xs text-slate-500">
          Having trouble? Contact the seminar organisers.
        </footer>
      </div>
    </main>
  );
}

function ComingSoon() {
  return (
    <div className="py-6 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-2xl">
        ⏳
      </div>
      <p className="text-lg font-semibold text-slate-900">
        Certificates will be available soon.
      </p>
      <p className="mt-2 text-sm text-slate-600">
        Please check back later.
      </p>
    </div>
  );
}
