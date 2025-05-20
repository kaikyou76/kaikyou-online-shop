/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-1713e92651fc463cba099b34f8bf5cb1.r2.dev",
      },
    ],
  },
};

export default nextConfig;
