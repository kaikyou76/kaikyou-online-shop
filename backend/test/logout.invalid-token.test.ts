import { describe, it, expect, vi, beforeEach } from "vitest";
import worker from "../src/worker";
import { createRequest } from "./utils/createRequest";
import { ExecutionContext } from "@cloudflare/workers-types";
import * as jwtModule from "../src/middleware/jwt";
import { createMockEnv } from "./utils/mockEnv";
import type { Env } from "../src/types/types";

describe("POST /api/logout - 無効なトークン", () => {
  let env: Env;

  beforeEach(() => {
    env = createMockEnv();
    env.ENVIRONMENT = "development"; // ← これでmetaも期待される
  });

  it("無効なJWTトークンで401エラーを返す", async () => {
    vi.spyOn(jwtModule, "jwtMiddleware").mockImplementationOnce(
      async (c, next) => {
        c.status(401);
        return c.json({
          error: {
            code: "INVALID_TOKEN",
            message: "無効なアクセストークンです",
            meta: {
              errorMessage: "JWT payload is missing or invalid",
            },
          },
        });
      }
    );

    const req = createRequest("http://localhost/api/logout", {
      method: "POST",
      headers: {
        Authorization: "Bearer invalid_token",
        "Content-Type": "application/json",
      },
    });

    const res = await worker.fetch(req as any, env, {} as ExecutionContext);
    expect(res.status).toBe(401);

    const data = await res.json();
    expect(data).toEqual({
      error: {
        code: "INVALID_TOKEN",
        message: "無効なアクセストークンです",
        meta: {
          errorMessage: "JWT payload is missing or invalid",
        },
      },
    });
  });
});
