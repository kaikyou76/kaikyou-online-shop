import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["**/node_modules/**"],
    reporters: ["default"],
    testTimeout: 30000,
    globals: true,
    environment: "cloudflare", // Cloudflare Workers環境を指定
    setupFiles: ["./test/setup.ts"], // テストセットアップファイル
    sequence: {
      hooks: "list",
    },
    poolOptions: {
      workers: {
        wrangler: {
          configPath: "./wrangler.jsonc", // Wrangler設定ファイル
        },
        miniflare: {
          // D1 データベースの設定
          d1Databases: {
            DB: "shopping-db", // D1 データベースの名前
          },
          // R2 バケットの設定
          r2Buckets: {
            R2_BUCKET: "dev-bucket", // R2 バケットの名前
          },
          // KV ネームスペースの設定
          kvNamespaces: ["TEST_SESSION"], // KVネームスペースの指定
          // Durable Objects の設定
          durableObjects: {
            TEST_DO: "TestDurableObject", // Durable Objectの指定
          },
          // 環境変数の設定
          vars: {
            JWT_SECRET: "local_dev_secret_do_not_use_in_prod",
            JWT_ISSUER: "kaikyou-shop-dev",
            JWT_AUDIENCE: "kaikyou-shop-users-dev",
            ENVIRONMENT: "development",
            R2_PUBLIC_DOMAIN: "localhost:8787/assets",
          },
        },
      },
    },
    coverage: {
      provider: "v8", // カバレッジプロバイダー
      include: ["src/endpoints/auth/**/*.ts"], // 認証関連のソースコードをカバレッジ対象に
      thresholds: {
        lines: 95, // 行カバレッジ目標値
        functions: 100, // 関数カバレッジ目標値
        branches: 90, // ブランチカバレッジ目標値
        statements: 95, // ステートメントカバレッジ目標値
      },
    },
  },
});
