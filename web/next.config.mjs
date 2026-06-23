import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin tracing to this app so a stray parent lockfile doesn't confuse Next.
  outputFileTracingRoot: __dirname,
  // @ffmpeg-installer/ffmpeg dynamically requires its platform sub-package and
  // ships a native binary — keep it a runtime require from node_modules (not
  // webpack-bundled) so resolution works and the binary is traced into the
  // serverless function. Used by lib/social/video.ts for the YouTube Short render.
  serverExternalPackages: ["@ffmpeg-installer/ffmpeg"],
  eslint: {
    // Lint is run separately; don't fail production builds on lint.
    ignoreDuringBuilds: true,
  },
  images: {
    // Allow next/image to optimize the public brand assets served from CloudFront.
    remotePatterns: [{ protocol: "https", hostname: "d5jzyan9wboi3.cloudfront.net" }],
  },
};

export default nextConfig;
