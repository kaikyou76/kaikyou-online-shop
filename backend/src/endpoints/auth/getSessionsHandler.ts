// backend/src/endpoints/auth/getSessionsHandler.ts
import { Context } from "hono";
import {
  Bindings,
  ErrorResponse,
  SuccessResponse,
  JwtPayload,
} from "../../types/types";

interface DBSession {
  id: number;
  user_id: number;
  session_token: string;
  expires_at: string; // DATETIME but returned as string
  user_agent: string | null;
  ip_address: string | null;
  created_at: string; // DATETIME but returned as string
  jwt_token?: string; // オプショナル
}

interface FormattedSession {
  id: number;
  sessionToken: string;
  expiresAt: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  isCurrent: boolean;
}

export const getSessionsHandler = async (
  c: Context<{ Bindings: Bindings; Variables: { jwtPayload?: JwtPayload } }>
): Promise<Response> => {
  const logPrefix = "[SESSION]";
  const startTime = Date.now();

  try {
    const payload = c.get("jwtPayload");
    console.log(`${logPrefix} 処理開始`, {
      user_id: payload?.user_id,
      method: c.req.method,
      path: c.req.path,
    });

    // 認証チェック
    if (!payload?.user_id) {
      console.error(`${logPrefix} 認証情報不足`, { payload });
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "認証情報が不正です",
          },
        },
        401
      );
    }

    // user_idの型チェック (防御的プログラミング)
    const userId = Number(payload.user_id);
    if (isNaN(userId) || userId <= 0) {
      console.error(`${logPrefix} 無効なuser_id`, {
        received: payload.user_id,
        type: typeof payload.user_id,
      });
      return c.json(
        {
          error: {
            code: "INVALID_USER_ID",
            message: "ユーザーIDが不正です",
            details: `Received: ${payload.user_id} (${typeof payload.user_id})`,
          },
        },
        400
      );
    }

    // DBクエリ実行
    const query = `
      SELECT
        id, user_id, session_token, expires_at,
        user_agent, ip_address, created_at, jwt_token
      FROM sessions
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `;

    console.log(`${logPrefix} DBクエリ実行`, { userId });
    const dbResult = await c.env.DB.prepare(query)
      .bind(userId)
      .all<DBSession>();

    if (!dbResult.success) {
      console.error(`${logPrefix} DBエラー`, dbResult.error);
      return c.json(
        {
          error: {
            code: "DB_ERROR",
            message: "セッション情報の取得に失敗しました",
            details: dbResult.error,
          },
        },
        500
      );
    }

    // 現在のJWTトークンを取得（Authorizationヘッダーから）
    const authHeader = c.req.header("Authorization");
    const currentToken = authHeader?.split(" ")[1];

    // レスポンス整形
    const sessions: FormattedSession[] = (dbResult.results || []).map(
      (session) => ({
        id: session.id,
        sessionToken: session.session_token,
        expiresAt: session.expires_at,
        userAgent: session.user_agent,
        ipAddress: session.ip_address,
        createdAt: session.created_at,
        isCurrent: session.jwt_token === currentToken, // 現在のセッションか判定
      })
    );

    console.log(`${logPrefix} 処理成功`, {
      count: sessions.length,
      duration: `${Date.now() - startTime}ms`,
    });

    return c.json({ data: sessions }, 200);
  } catch (error) {
    console.error(`${logPrefix} 予期せぬエラー`, error);
    return c.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "セッションの取得中にエラーが発生しました",
          details: error instanceof Error ? error.message : String(error),
        },
      },
      500
    );
  }
};
