// backend/test/login.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import worker from "../src/worker"; // worker.ts からインポート
import type { Env } from "../src/types/types";
import { createRequest } from "./utils/createRequest";
import { ExecutionContext } from "@cloudflare/workers-types";
import * as authUtils from "../src/lib/auth"; // auth.ts からインポート

type LoginSuccessResponse = {
  data: {
    token: string;
    user: {
      id: number;
      name: string;
      email: string;
      role: string;
    };
  };
};

type ErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};

describe("POST /api/login", () => {
  const dummyUser = {
    id: 1,
    email: "test@example.com",
    password_hash: "hashedpw",
    name: "Test User",
    role: "user",
  };

  let env: Env;

  beforeEach(() => {
    vi.restoreAllMocks();

    // モック環境を設定
    env = {
      ENVIRONMENT: "test",
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(dummyUser),
          }),
        }),
      },
      JWT_SECRET: "test-secret",
      JWT_ISSUER: "test-issuer",
      JWT_AUDIENCE: "test-audience",
    } as unknown as Env;

    // モック関数を設定
    vi.spyOn(authUtils, "verifyPassword").mockResolvedValue(true);
    vi.spyOn(authUtils, "generateAuthToken").mockResolvedValue("mocked-jwt");
  });

  // リクエストを作成するヘルパー関数
  const makeRequest = (body: object) =>
    createRequest("http://localhost/api/login", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });

  // 正常系: ログイン成功
  it("ログイン成功時にJWTとユーザー情報を返す", async () => {
    const req = makeRequest({
      email: dummyUser.email,
      password: "password123",
    });

    const res = await worker.fetch(req as any, env, {} as ExecutionContext);
    const json = (await res.json()) as LoginSuccessResponse;

    // ステータスコードとレスポンスを検証
    expect(res.status).toBe(200);
    expect(json.data.token).toBe("mocked-jwt");
    expect(json.data.user).toEqual({
      id: dummyUser.id,
      name: dummyUser.name,
      email: dummyUser.email,
      role: dummyUser.role,
    });
  });

  // 異常系: パスワードが間違っている
  it("パスワードが間違っている場合、401エラーを返す", async () => {
    vi.spyOn(authUtils, "verifyPassword").mockResolvedValue(false);

    const req = makeRequest({
      email: dummyUser.email,
      password: "wrongpassword",
    });

    const res = await worker.fetch(req as any, env, {} as ExecutionContext);
    const json = (await res.json()) as ErrorResponse;

    // ステータスコードとエラーメッセージを検証
    expect(res.status).toBe(401);
    expect(json.error.code).toBe("INVALID_CREDENTIALS");
    expect(json.error.message).toBe(
      "メールアドレスまたはパスワードが正しくありません"
    );
  });

  // 異常系: ユーザーが存在しない
  it("ユーザーが存在しない場合、401エラーを返す", async () => {
    // ユーザーが見つからないようにモックを設定
    (env.DB.prepare as any) = vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null),
      }),
    });

    const req = makeRequest({
      email: "no-user@example.com",
      password: "whatever",
    });

    const res = await worker.fetch(req as any, env, {} as ExecutionContext);
    const json = (await res.json()) as ErrorResponse;

    // ステータスコードとエラーメッセージを検証
    expect(res.status).toBe(401);
    expect(json.error.code).toBe("INVALID_CREDENTIALS");
    expect(json.error.message).toBe(
      "メールアドレスまたはパスワードが正しくありません"
    );
  });

  // 異常系: バリデーションエラー（emailなし）
  it("emailが入力されていない場合、400エラーを返す", async () => {
    const req = makeRequest({ password: "password123" });

    const res = await worker.fetch(req as any, env, {} as ExecutionContext);
    const json = (await res.json()) as ErrorResponse;

    // ステータスコードとエラーメッセージを検証
    expect(res.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(json.error.message).toBe(
      "メールアドレスとパスワードを正しく入力してください"
    );
  });

  // 異常系: 内部サーバーエラー
  it("DBクエリが失敗した場合、500エラーを返す", async () => {
    // DBクエリが失敗するようにモックを設定
    (env.DB.prepare as any) = vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockRejectedValue(new Error("Database error")),
      }),
    });

    const req = makeRequest({
      email: dummyUser.email,
      password: "password123",
    });

    const res = await worker.fetch(req as any, env, {} as ExecutionContext);
    const json = (await res.json()) as ErrorResponse;

    // ステータスコードとエラーメッセージを検証
    expect(res.status).toBe(500);
    expect(json.error.code).toBe("INTERNAL_ERROR");
    expect(json.error.message).toBe("ログイン処理に失敗しました");
  });
});
