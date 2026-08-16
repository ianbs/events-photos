import type { NextConfig } from "next";

function getSupabaseStoragePattern(): NonNullable<
  NextConfig["images"]
>["remotePatterns"] {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!rawUrl) {
    return [];
  }

  const url = new URL(rawUrl);
  const protocol = url.protocol === "http:" ? "http" : "https";

  return [
    {
      hostname: url.hostname,
      pathname: "/storage/v1/**",
      port: url.port,
      protocol,
    },
  ];
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: getSupabaseStoragePattern(),
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
