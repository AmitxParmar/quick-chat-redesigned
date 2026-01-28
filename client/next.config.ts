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
    ],
  },
};

export default process.env.ANALYZE === "true"
  ? initializeBundleAnalyzer({ enabled: true })(nextConfig)
  : nextConfig;
