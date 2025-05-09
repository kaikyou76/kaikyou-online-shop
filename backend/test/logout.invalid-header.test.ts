import { describe, it, expect, vi } from "vitest";
import worker from "../src/worker";
import { createMockEnv } from "./utils/mockEnv";
import type { Env } from "../src/types/types";
import { createRequest } from "./utils/createRequest";
import { ExecutionContext } from "@cloudflare/workers-types";

let env: Env;

describe("POST /api/logout - 不正なヘッダ形式", () => {
  env = createMockEnv();
  const testCases = [
    { header: "InvalidTokenFormat", description: "プレフィックスなし" },
    { header: "BearerInvalidFormat", description: "形式不正" },
    { header: "Basic abc123", description: "基本認証形式" },
  ];

  testCases.forEach(({ header, description }) => {
    it(`${description}で401エラーを返す`, async () => {
      const req = createRequest("http://localhost/api/logout", {
        method: "POST",
        headers: {
          Authorization: header,
          "Content-Type": "application/json",
        },
      });

      const res = await worker.fetch(req as any, env, {} as ExecutionContext);
      expect(res.status).toBe(401);
    });
  });
});
