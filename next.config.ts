import type { NextConfig } from "next";

function getStoragePatterns(): NonNullable<
  NextConfig["images"]
>["remotePatterns"] {
  const patterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [];
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (rawUrl) {
    const url = new URL(rawUrl);
    const protocol = url.protocol === "http:" ? "http" : "https";

    patterns.push({
      hostname: url.hostname,
      pathname: "/storage/v1/**",
      port: url.port,
      protocol,
    });
  }

  const rawS3Endpoint = process.env.S3_ENDPOINT;

  if (rawS3Endpoint) {
    const endpoint = new URL(rawS3Endpoint);
    const protocol = endpoint.protocol === "http:" ? "http" : "https";

    patterns.push(
      {
        hostname: endpoint.hostname,
        pathname: "/**",
        port: endpoint.port,
        protocol,
      },
      {
        hostname: `**.${endpoint.hostname}`,
        pathname: "/**",
        port: endpoint.port,
        protocol,
      },
    );
  }

  return patterns;
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: getStoragePatterns(),
  },
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), geolocation=(), microphone=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
