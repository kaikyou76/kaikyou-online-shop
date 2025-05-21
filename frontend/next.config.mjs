// frontend/next.config.mjs
const isProduction = process.env.NODE_ENV === "production";

const nextConfig = {
  images: {
    remotePatterns:
      isProduction && process.env.R2_PUBLIC_DOMAIN
        ? [
            {
              protocol: "https",
              hostname: process.env.R2_PUBLIC_DOMAIN.replace(
                /^https?:\/\//,
                ""
              ),
            },
          ]
        : [],
  },
};

export default nextConfig;
