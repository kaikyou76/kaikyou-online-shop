import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import worker from "../src/worker"; // パスを修正
import type { Env } from "../src/types/types";
import { createRequest } from "./utils/createRequest";
import { ExecutionContext } from "@cloudflare/workers-types";
import * as jwtModule from "../src/middleware/jwt";

type LogoutSuccessResponse = {
  data: {
    success: boolean;
  };
};

describe("POST /api/logout - 正常系", () => {
  let env: Env;
  const validToken = "valid_session_token_123";
  const mockJwtPayload = {
    user_id: 1,
    email: "test@example.com",
    exp: Math.floor(Date.now() / 1000) + 7200,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(jwtModule, "jwtMiddleware").mockImplementation(async (c, next) => {
      c.set("jwtPayload", mockJwtPayload);
      await next();
    });

    env = getMockEnv();
  });

  afterEach(() => vi.clearAllMocks());

  const makeRequest = () =>
    createRequest("http://localhost/api/logout", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${validToken}`,
        "Content-Type": "application/json",
      },
    });

  it("有効なJWTトークンでログアウト成功", async () => {
    const req = makeRequest();
    const res = await worker.fetch(req as any, env, {} as ExecutionContext);
    const json = (await res.json()) as LogoutSuccessResponse;

    expect(res.status).toBe(200);
    expect(json.data.success).toBe(true);
    expect(env.DB.prepare).toHaveBeenCalledWith(
      "DELETE FROM sessions WHERE session_token = ?"
    );
  });
});

function getMockEnv(): Env {
  return {
    ENVIRONMENT: "test",
    JWT_SECRET: "test_secret",
    DB: {
      prepare: vi.fn().mockImplementation(() => ({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
        first: vi.fn(),
        all: vi.fn(),
        raw: vi.fn(),
      })),
    },
  } as unknown as Env;
}
