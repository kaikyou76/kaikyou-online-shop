// frontend/next.config.mjs
const isProduction = process.env.NODE_ENV === "production";

const sanitizeDomain = (domain) => {
  if (!domain) return null;
  return domain.replace(/^https?:\/\//, "").split("/")[0];
};

const r2Domain =
  sanitizeDomain(process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN) ||
  "pub-1713e92651fc463cba099b34f8bf5cb1.r2.dev";

const nextConfig = {
  images: {
    // 互換性維持のためdomainsも設定
    domains: [r2Domain],

    // 最新のNext.jsではremotePatternsが推奨
    remotePatterns: [
      {
        protocol: "https",
        hostname: r2Domain,
        pathname: "/products/**",
      },
      {
        protocol: "https",
        hostname: r2Domain,
        pathname: "/**", // 全パスを許可する場合
      },
    ],

    // Cloudflare R2使用時の最適設定
    unoptimized: true, // R2の場合は画像最適化を無効に
    minimumCacheTTL: 60, // キャッシュ時間（秒）

    // 開発環境用追加設定
    ...(!isProduction && {
      deviceSizes: [640, 750, 828, 1080, 1200],
      imageSizes: [16, 32, 48, 64, 96],
    }),
  },

  // 実験的機能（必要に応じて）
  experimental: {
    staleTimes: {
      dynamic: 60,
      static: 60,
    },
  },
};

export default nextConfig;
