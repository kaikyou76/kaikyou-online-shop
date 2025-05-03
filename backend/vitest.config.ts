// backend/vitest.config.ts
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["**/node_modules/**"],
    reporters: ["default"],
    testTimeout: 30000,
    globals: true,
    poolOptions: {
      workers: {
        wrangler: {
          configPath: "./wrangler.jsonc", // 拡張子は .toml を使うのが標準
        },
        miniflare: {
          kvNamespaces: ["TEST_SESSION"], // 任意：KVネームスペースの指定（Miniflare）
          durableObjects: {
            TEST_DO: "TestDurableObject", // 任意：Durable Object名（wrangler.toml側と一致）
          },
        },
      },
    },
    sequence: {
      hooks: "list",
    },
  },
});
