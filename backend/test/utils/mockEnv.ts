// backend/test/utils/mockEnv.ts
import { vi } from "vitest";
import type { Env } from "../../src/types/types";

export const createMockEnv = (): Env => ({
  ENVIRONMENT: "development",
  JWT_SECRET: "test-secret",
  JWT_ISSUER: "kaikyou-shop-test",
  JWT_AUDIENCE: "kaikyou-shop-users-test",
  R2_PUBLIC_DOMAIN: "localhost:8787/assets",

  DB: {
    prepare: vi.fn().mockImplementation((query: string) => {
      if (query.includes("SELECT")) {
        return {
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue({
            session_token: "valid-token",
            user_id: 1,
          }),
          all: vi.fn(),
          raw: vi.fn(),
        };
      }
      if (query.includes("DELETE")) {
        return {
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ success: true }),
          all: vi.fn(),
          raw: vi.fn(),
        };
      }
      return {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: false }),
        all: vi.fn(),
        raw: vi.fn(),
      };
    }),
  } as any,

  R2_BUCKET: {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  } as any,
});
