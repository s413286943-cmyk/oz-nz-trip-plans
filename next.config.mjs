import path from "node:path";
import { fileURLToPath } from "node:url";

import { contentSecurityPolicy } from "./scripts/security-headers.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const dev = process.env.NODE_ENV === "development";

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: root,
  turbopack: { root },
  images: { unoptimized: true },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy({ dev }) },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      // Route pictures (not the pages under /nz and /au2026). They keep their file names between exports,
      // so a week is the longest a phone may reuse one without asking again.
      {
        source: "/:dir(nz|au2026)/:file(.+\\.(?:jpg|jpeg|png|webp|avif))",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
    ];
  },
};

export default nextConfig;
