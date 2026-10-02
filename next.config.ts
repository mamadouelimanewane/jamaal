import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    // Photos produits de démonstration servies par le CDN Chogan.
    remotePatterns: [{ protocol: "https", hostname: "cdn.chogangroupspa.com", pathname: "/images/prodotti/**" }],
  },
};

export default nextConfig;
