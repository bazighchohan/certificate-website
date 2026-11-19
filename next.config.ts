import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ship the template and fonts with the serverless functions that read them.
  outputFileTracingIncludes: {
    "/api/certificate": ["./public/template.pdf", "./public/fonts/**/*"],
    "/api/preview": ["./public/template.pdf", "./public/fonts/**/*"],
  },
};

export default nextConfig;
