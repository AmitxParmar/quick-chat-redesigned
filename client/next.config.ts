import type { NextConfig } from "next";
import initializeBundleAnalyzer from "@next/bundle-analyzer";

const nextConfig: NextConfig = {
  compress: true,
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-avatar",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-label",
      "@radix-ui/react-slot",
      "date-fns",
      "emoji-picker-react",
      "@tanstack/react-query",
      "@tanstack/react-virtual",
      "react-hook-form",
      "@hookform/resolvers",
      "zod",
      "sonner",
      "zustand",
    ],
  },
};

export default process.env.ANALYZE === "true"
  ? initializeBundleAnalyzer({ enabled: true })(nextConfig)
  : nextConfig;
