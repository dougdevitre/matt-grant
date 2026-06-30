import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin tracing to this app so a stray parent lockfile doesn't confuse Next.
  outputFileTracingRoot: __dirname,
  // BUNDLE_GUARD=1 emits the standalone server (server + traced node_modules) so CI can
  // measure a faithful proxy of the Amplify SSR compute bundle and fail a PR BEFORE it
  // tips the hard 220 MiB cap at deploy time. Unset in the real Amplify build, so its
  // default .next output (what the Amplify Next adapter expects) is unchanged.
  ...(process.env.BUNDLE_GUARD === "1" ? { output: "standalone" } : {}),
  // sharp ships native binaries (used at runtime by the asset-library upload route to
  // compress images + the next/image optimizer, and at build time by scripts/*.mjs).
  // Keep it external so the platform binary resolves and is traced into the serverless
  // function rather than webpack-bundled.
  //
  // @ffmpeg-installer is deliberately NOT external here: its ~35 MB binary pushed the
  // Amplify SSR compute bundle past the hard 220 MiB cap (deploys failed). lib/social/
  // video.ts now loads it via a computed specifier so it isn't traced/bundled at all;
  // it resolves from node_modules only where present (local/tests). See the bundle note
  // there. Re-home video rendering to a dedicated Lambda to restore it in production.
  serverExternalPackages: ["sharp"],
  eslint: {
    // Lint is run separately; don't fail production builds on lint.
    ignoreDuringBuilds: true,
  },
  images: {
    // Emit AVIF (then WebP) — without this Next serves only WebP, leaving the
    // "next-gen formats" savings on the table for the homepage infographic,
    // portraits, the arch, and every other next/image across the site. The
    // optimizer (sharp) negotiates per request and caches the result.
    formats: ["image/avif", "image/webp"],
    // Allow next/image to optimize the public brand assets served from CloudFront.
    remotePatterns: [{ protocol: "https", hostname: "d5jzyan9wboi3.cloudfront.net" }],
  },
  async headers() {
    // Lock down the synced pillar tools. Each /pillar-tools/* file is HTML imported
    // from an external access-to-* repo and embedded in a sandboxed iframe, so treat
    // it as untrusted. The load-bearing directives: connect-src 'none' (a running tool
    // can't phone home / exfiltrate anything the visitor types) and frame-ancestors
    // 'self' (only this app may embed it). 'unsafe-inline' is required — the tools ship
    // inline <script>/<style>. Next applies these headers to public/ assets too.
    const toolCsp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'none'",
      "form-action 'none'",
      "base-uri 'none'",
      "frame-ancestors 'self'",
    ].join("; ");
    return [
      {
        source: "/pillar-tools/:path*",
        headers: [
          { key: "Content-Security-Policy", value: toolCsp },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
