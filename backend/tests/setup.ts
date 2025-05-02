//backend/test/setup.ts
import { Miniflare } from "miniflare";
import { migrate } from "./migrations";
import type { D1Database } from "@cloudflare/workers-types";

let mf: Miniflare;

beforeAll(async () => {
  mf = new Miniflare({
    modules: true,
    scriptPath: "./dist/worker.js",
    compatibilityDate: "2024-01-01",
    d1Databases: ["DB"],
  });

  //Miniflare が提供するテスト用の仮想 D1 データベースを取得します。
  const db = await mf.getD1Database("DB");
  await migrate(db); // データベースマイグレーション実行
});

afterAll(() => mf.dispose());

// グローバルヘルパー関数の定義
declare global {
  var getTestEnv: () => Promise<{
    db: D1Database;
    mf: Miniflare;
  }>;
}

global.getTestEnv = async () => {
  const db = await mf.getD1Database("DB");
  return { db, mf };
};
