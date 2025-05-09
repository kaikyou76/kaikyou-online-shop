import { describe, it, expect, vi, beforeEach } from "vitest";
import worker from "../src/worker";
import type { Env } from "../src/types/types";
import { createRequest } from "./utils/createRequest";
import { ExecutionContext } from "@cloudflare/workers-types";
import * as jwtModule from "../src/middleware/jwt";
import { createMockEnv } from "./utils/mockEnv"; // ✅ 追加

let env: Env;

type ErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};

describe("POST /api/logout - データベースエラー", () => {
  const validToken = "valid_session_token_123";

  beforeEach(() => {
    vi.spyOn(jwtModule, "jwtMiddleware").mockImplementation(async (c, next) => {
      await next();
    });

    env = createMockEnv(); // ✅ 差し替え
    // run() のみを reject に差し替える
    (env.DB.prepare as any).mockImplementation(() => ({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockRejectedValue(new Error("Database failure")),
      first: vi.fn(),
      all: vi.fn(),
      raw: vi.fn(),
    }));
  });

  const makeRequest = () =>
    createRequest("http://localhost/api/logout", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${validToken}`,
        "Content-Type": "application/json",
      },
    });

  it("データベースエラー時に500エラーを返す", async () => {
    const req = makeRequest();
    const res = await worker.fetch(req as any, env, {} as ExecutionContext);
    const json = (await res.json()) as ErrorResponse;

    expect(res.status).toBe(500);
    expect(json.error.code).toBe("INTERNAL_ERROR");
  });
});
