import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "covers.openlibrary.org",
      },
      {
        protocol: "https",
        hostname: "**.airtableusercontent.com",
      },
      {
        protocol: "https",
        hostname: "dl.airtable.com",
      },
    ],
  },
}

export default nextConfig
