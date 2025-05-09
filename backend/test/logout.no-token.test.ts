import { describe, it, expect, vi, beforeEach } from "vitest";
import worker from "../src/worker";
import { createRequest } from "./utils/createRequest";
import type { Env } from "../src/types/types";
import { ExecutionContext } from "@cloudflare/workers-types";
import * as jwtModule from "../src/middleware/jwt";

// ✅ 1. ErrorResponse 型を定義
type ErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string;
  };
};

describe("POST /api/logout - トークンなし", () => {
  let env: Env;

  beforeEach(() => {
    // ✅ 2. モック実装で c.json<ErrorResponse> を使用
    vi.spyOn(jwtModule, "jwtMiddleware").mockImplementation(async (c) => {
      c.status(401);
      c.header("WWW-Authenticate", "Bearer");
      c.header("X-Content-Type-Options", "nosniff");
      return c.json<ErrorResponse>({
        success: false,
        error: {
          code: "INVALID_AUTH_HEADER",
          message: "Authorization: Bearer <token> 形式が必要です",
        },
      });
    });

    // モック環境
    env = {
      ENVIRONMENT: "test",
      JWT_SECRET: "test_secret",
      DB: {
        prepare: vi.fn().mockImplementation(() => ({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: false }),
          first: vi.fn(),
          all: vi.fn(),
          raw: vi.fn(),
        })),
      },
    } as unknown as Env;
  });

  const makeRequest = () =>
    createRequest("http://localhost/api/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

  it("トークンなしで401エラーを返す", async () => {
    const req = makeRequest();
    const res = await worker.fetch(req as any, env, {} as ExecutionContext);
    const json = (await res.json()) as ErrorResponse;

    expect(res.status).toBe(401);
    expect(json.error.code).toBe("INVALID_AUTH_HEADER");
    expect(json.error.message).toContain("Bearer <token>");
  });
});
