import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "192.168.0.88",
    "192.168.1.88",
    "storiia.local",
    "*.trycloudflare.com",
    "prize-outreach-eco-inspired.trycloudflare.com",
  ],
};

export default nextConfig;
