import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["firebase-admin", "pdf-parse", "mammoth"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors 'self' ${process.env.EMBED_ORIGIN || ""}; object-src 'none'; base-uri 'self'`,
          },
        ],
      },
    ];
  },
};
export default config;
