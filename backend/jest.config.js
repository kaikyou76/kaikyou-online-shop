// backend/jest.config.js
module.exports = {
  preset: "ts-jest",
  testEnvironment: "miniflare",
  testEnvironmentOptions: {
    // Miniflare の設定
    bindings: {
      JWT_SECRET: "test_secret",
      JWT_ISSUER: "test_issuer",
      JWT_AUDIENCE: "test_audience",
      ENVIRONMENT: "test",
      R2_PUBLIC_DOMAIN: "test.example.com",
    },
    modules: true,
    kvNamespaces: [],
    d1Databases: ["DB"],
    r2Buckets: ["R2_BUCKET"],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testMatch: ["**/test/**/*.test.ts"],
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  setupFilesAfterEnv: ["./test/setup.ts"],

  // カバレッジ設定の追加
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts", // 型定義ファイルは除外
    "!src/worker.ts", // エントリーポイントは除外
  ],
  coverageReporters: ["text", "lcov"], // テキストとHTMLで出力
};
