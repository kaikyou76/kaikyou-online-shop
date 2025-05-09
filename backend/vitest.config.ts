// vitest.config.ts
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" }, // Wranglerの設定ファイルを指定
        miniflare: {
          kvNamespaces: ["TEST_NAMESPACE"], // テスト用のKVネームスペースを追加
        },
      },
    },
    coverage: {
      reporter: ["text", "json", "lcov", "html"], // カバレッジ報告の形式を指定
      provider: "istanbul", // V8の代わりにIstanbulを使用
      reportsDirectory: "coverage", // デフォルトでも coverage/
    },
  },
});
