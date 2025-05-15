// backend/src/middleware/sessionMiddleware.ts
import { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import type { Env } from "../types/types";
import { validateSession, type SessionData } from "../utils/session";

declare module "hono" {
  interface ContextVariableMap {
    session: SessionData;
  }
}

export const sessionMiddleware: MiddlewareHandler<{
  Bindings: Env;
}> = async (c, next) => {
  // 1. セッショントークンの取得 (CookieまたはAuthorizationヘッダーから)
  const sessionToken =
    getCookie(c, "session_token") ||
    c.req.header("Authorization")?.split("Bearer ")[1];

  if (!sessionToken) {
    return c.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "認証が必要です",
          docs: "https://api.example.com/docs/authentication",
        },
      },
      401
    );
  }

  // トークンの基本的な検証
  if (typeof sessionToken !== "string" || sessionToken.length < 32) {
    return c.json(
      {
        error: {
          code: "INVALID_TOKEN_FORMAT",
          message: "無効なトークン形式",
        },
      },
      400
    );
  }

  try {
    // 2. セッションの検証
    const session = await validateSession(sessionToken, c.env);

    // 3. セッション有効期限のチェック
    if (session.expires_at && new Date(session.expires_at) < new Date()) {
      return c.json(
        {
          error: {
            code: "SESSION_EXPIRED",
            message: "セッションの有効期限が切れています",
          },
        },
        401
      );
    }

    // 4. セッション情報をコンテキストに設定
    c.set("session", session);

    // 5. セキュリティ情報のロギング (監査ログ用)
    if (c.env.ENVIRONMENT === "production") {
      console.log({
        event: "session_accessed",
        sessionId: session.id,
        userId: session.user_id,
        ip: c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For"),
        userAgent: c.req.header("User-Agent"),
        timestamp: new Date().toISOString(),
      });
    }

    await next();
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));

    // エラーロギング
    console.error("Session validation error:", {
      error: error.message,
      stack: error.stack,
      token: sessionToken.substring(0, 8) + "...",
    });

    return c.json(
      {
        error: {
          code: "INVALID_SESSION",
          message: "無効なセッション",
          ...(c.env.ENVIRONMENT === "development" && {
            details: error.message,
          }),
        },
      },
      401
    );
  }
};
