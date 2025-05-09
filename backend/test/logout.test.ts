import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import worker from "../src/worker";
import type { Env } from "../src/types/types";
import { createRequest } from "./utils/createRequest";
import { ExecutionContext } from "@cloudflare/workers-types";
import * as jwtModule from "../src/middleware/jwt";
import { createMockEnv } from "./utils/mockEnv";
import { SignJWT } from "jose";

type SuccessResponse = {
  data: { success: boolean };
};

describe("POST /api/logout - 統合テスト", () => {
  let env: Env;
  let validToken: string;
  const mockJwtPayload = {
    user_id: 1,
    email: "test@example.com",
    iss: "kaikyou-shop-test",
    aud: "kaikyou-shop-users-test",
    exp: Math.floor(Date.now() / 1000) + 7200,
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    env = createMockEnv();

    // 環境変数確認ログ（ここに追加）
    console.log("\n[環境変数確認]");
    console.log("JWT_ISSUER:", env.JWT_ISSUER);
    console.log("JWT_AUDIENCE:", env.JWT_AUDIENCE);

    // 有効なトークン生成
    validToken = await new SignJWT(mockJwtPayload) // クレームを統一
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(env.JWT_ISSUER)
      .setAudience(env.JWT_AUDIENCE)
      .setExpirationTime("2h")
      .sign(new TextEncoder().encode(env.JWT_SECRET));

    // トークン検証デバッグ（ここに追加）
    console.log("\n[トークン情報]");
    console.log("Generated Token:", validToken);
    console.log("Mock Payload:", mockJwtPayload);

    // JWTミドルウェアの深度モック
    vi.spyOn(jwtModule, "jwtMiddleware").mockImplementation(async (c, next) => {
      console.log("[Middleware] JWT処理開始"); // ミドルウェア開始ログ
      // 実際のトークン検証プロセスをシミュレート
      const authHeader = c.req.header("Authorization");
      console.log("Received headers:", c.req.header);
      // リクエストヘッダーの取得方法を修正
      console.log("[Middleware] Authorization Header:", authHeader); // ヘッダー確認
      if (!authHeader?.startsWith("Bearer ")) {
        console.log("[Middleware] 無効なヘッダー検出");
        c.status(401);
        return c.json({ error: "Invalid header" });
      }

      c.set("jwtPayload", mockJwtPayload);
      console.log("[Middleware] JWTペイロード設定完了");
      await next();
      console.log("[Middleware] 後処理完了");
    });
  });

  afterEach(() => vi.clearAllMocks());

  describe("正常系", () => {
    it("有効なトークンでのログアウト成功", async () => {
      const req = createRequest("http://localhost/api/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${validToken}`,
          "Content-Type": "application/json",
        },
      });

      const res = await worker.fetch(req as any, env, {} as ExecutionContext);
      const json = (await res.json()) as SuccessResponse;

      expect(res.status).toBe(200);
      expect(json.data.success).toBe(true);

      // データベース操作の検証
      expect(env.DB.prepare).toHaveBeenNthCalledWith(
        1,
        "SELECT * FROM sessions WHERE session_token = ?"
      );
      expect(env.DB.prepare).toHaveBeenNthCalledWith(
        2,
        "DELETE FROM sessions WHERE session_token = ?"
      );
    });
  });
});
