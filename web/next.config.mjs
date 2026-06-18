import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin tracing to this app so a stray parent lockfile doesn't confuse Next.
  outputFileTracingRoot: __dirname,
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
