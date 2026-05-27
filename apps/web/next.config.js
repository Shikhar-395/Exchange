/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/ui"],
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "backpack.exchange",
        pathname: "/coins/**",
      },
    ],
  },
};

export default nextConfig;
