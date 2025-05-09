// backend/test/register.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import worker from "../src/worker";
import type { Env } from "../src/types/types";
import { createRequest } from "./utils/createRequest";
import { ExecutionContext } from "@cloudflare/workers-types";
import * as authUtils from "../src/lib/auth";

type RegisterSuccessResponse = {
  data: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
};

type ErrorResponse = {
  error: {
    code: string;
    message: string;
    issues?: Array<{ path: string[]; message: string }>;
  };
};

describe("POST /api/register", () => {
  const validPayload = {
    name: "テストユーザー",
    email: "new@example.com",
    password: "SecurePass123!",
  };

  let env: Env;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {}); // suppress error logs

    env = {
      ENVIRONMENT: "test",
      DB: {
        prepare: vi.fn().mockImplementation((query: string) => {
          if (query.startsWith("SELECT")) {
            return {
              bind: () => ({
                first: vi.fn().mockResolvedValue(null), // user not found
              }),
            };
          }
          if (query.startsWith("INSERT")) {
            return {
              bind: () => ({
                first: vi.fn().mockResolvedValue({ id: 1 }), // inserted user ID
              }),
            };
          }
          return { bind: () => ({ first: vi.fn() }) };
        }),
      },
    } as unknown as Env;

    vi.spyOn(authUtils, "hashPassword").mockResolvedValue("hashed_password");
  });

  const makeRequest = (body: object) =>
    createRequest("http://localhost/api/register", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });

  // 正常系テスト
  describe("正常系テスト", () => {
    it("有効な情報でユーザー登録に成功する", async () => {
      const req = makeRequest(validPayload);
      const res = await worker.fetch(req as any, env, {} as ExecutionContext);
      const json = (await res.json()) as RegisterSuccessResponse;

      expect(res.status).toBe(201);
      expect(json.data).toEqual({
        id: 1,
        name: validPayload.name,
        email: validPayload.email,
        role: "user",
      });

      expect(authUtils.hashPassword).toHaveBeenCalledWith(
        validPayload.password
      );
    });
  });

  describe("入力検証異常系テスト", () => {
    const testCases = [
      {
        name: "名前が短すぎる",
        payload: { ...validPayload, name: "A" },
        expectedError: "名前は2文字以上で入力してください",
      },
      {
        name: "メール形式が不正",
        payload: { ...validPayload, email: "invalid-email" },
        expectedError: "正しいメールアドレスを入力してください",
      },
      {
        name: "パスワードが短い",
        payload: { ...validPayload, password: "short" },
        expectedError: "パスワードは8文字以上で入力してください",
      },
      {
        name: "必須項目欠落（名前）",
        payload: { email: validPayload.email, password: validPayload.password },
        expectedError: "Required",
      },
    ];

    testCases.forEach(({ name, payload, expectedError }) => {
      it(`${name}場合に400エラーを返す`, async () => {
        const req = makeRequest(payload);
        const res = await worker.fetch(req as any, env, {} as ExecutionContext);
        const json = (await res.json()) as ErrorResponse;

        expect(res.status).toBe(400);
        expect(json.error.code).toBe("VALIDATION_ERROR");
        expect(json.error.issues).toBeDefined();
        expect(
          json.error.issues?.some((issue) =>
            issue.message.includes(expectedError)
          )
        ).toBeTruthy();
      });
    });
  });

  describe("ビジネスロジック異常系テスト", () => {
    it("既存メールアドレスで409エラーを返す", async () => {
      (env.DB.prepare as any).mockImplementation((query: string) => {
        if (query.startsWith("SELECT")) {
          return {
            bind: () => ({
              first: vi.fn().mockResolvedValue({ id: 1 }),
            }),
          };
        }
        return {
          bind: () => ({
            first: vi.fn().mockResolvedValue(null),
          }),
        };
      });

      const req = makeRequest(validPayload);
      const res = await worker.fetch(req as any, env, {} as ExecutionContext);
      const json = (await res.json()) as ErrorResponse;

      expect(res.status).toBe(409);
      expect(json.error.code).toBe("EMAIL_EXISTS");
      expect(json.error.message).toBe(
        "このメールアドレスは既に使用されています"
      );
    });

    it("データベースエラー時に500エラーを返す", async () => {
      (env.DB.prepare as any).mockImplementation(() => {
        throw new Error("DB Failure");
      });

      const req = makeRequest(validPayload);
      const res = await worker.fetch(req as any, env, {} as ExecutionContext);
      const json = (await res.json()) as ErrorResponse;

      expect(res.status).toBe(500);
      expect(json.error.code).toBe("INTERNAL_ERROR");
      expect(json.error.message).toBe("ユーザー登録に失敗しました");
    });

    it("ユーザー作成失敗時に500エラーを返す", async () => {
      (env.DB.prepare as any)
        .mockImplementationOnce((query: string) => {
          return {
            bind: () => ({
              first: vi.fn().mockResolvedValue(null), // SELECT → user not found
            }),
          };
        })
        .mockImplementationOnce((query: string) => {
          return {
            bind: () => ({
              first: vi.fn().mockResolvedValue(null), // INSERT → no id returned
            }),
          };
        });

      const req = makeRequest(validPayload);
      const res = await worker.fetch(req as any, env, {} as ExecutionContext);
      const json = (await res.json()) as ErrorResponse;

      expect(res.status).toBe(500);
      expect(json.error.code).toBe("INTERNAL_ERROR");
    });
  });

  describe("セキュリティテスト", () => {
    it("パスワードを平文で保存しない", async () => {
      const insertSpy = vi.fn().mockResolvedValue({ id: 1 });

      (env.DB.prepare as any)
        .mockImplementationOnce((query: string) => {
          return {
            bind: () => ({
              first: vi.fn().mockResolvedValue(null),
            }),
          };
        })
        .mockImplementationOnce((query: string) => {
          return {
            bind: vi.fn((...args: any[]) => {
              // 検証: 平文のパスワードが含まれていない
              expect(args[2]).not.toBe(validPayload.password);
              return { first: insertSpy };
            }),
          };
        });

      const req = makeRequest(validPayload);
      const res = await worker.fetch(req as any, env, {} as ExecutionContext);
      expect(res.status).toBe(201);
      expect(insertSpy).toHaveBeenCalled();
    });
  });
});
