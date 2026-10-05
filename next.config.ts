import type { NextConfig } from "next";
import { securityHeaders } from "./lib/security-headers";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  headers: async () => securityHeaders(process.env.NODE_ENV !== "production"),
};

export default config;
