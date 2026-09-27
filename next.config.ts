import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Old bookmarks from before the Kitchen / Me tabs.
  async redirects() {
    return [{ source: "/private", destination: "/me", permanent: false }];
  },
};

export default nextConfig;
