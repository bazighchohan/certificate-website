// Client-safe certificate type definitions (no server imports).

export const CERT_TYPES = ["participation", "appreciation"] as const;
export type CertType = (typeof CERT_TYPES)[number];

export const CERT_LABELS: Record<CertType, string> = {
  participation: "Participation Certificate",
  appreciation: "Appreciation Certificate",
};

export function isCertType(v: unknown): v is CertType {
  return typeof v === "string" && (CERT_TYPES as readonly string[]).includes(v);
}
