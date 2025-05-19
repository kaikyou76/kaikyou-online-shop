// backend/src/endpoints/auth/validate.ts
import { Context } from "hono";
import type {
  Bindings,
  ErrorResponse,
  SuccessResponse,
  JwtPayload,
} from "../../types/types";

export const validateHandler = async (
  c: Context<{
    Bindings: Bindings;
    Variables: { jwtPayload: JwtPayload };
  }>
): Promise<Response> => {
  const payload = c.get("jwtPayload");

  // セッション有効性チェック（必要な場合のみ）
  const session = await c.env.DB.prepare(
    "SELECT 1 FROM sessions WHERE jwt_token = ? AND expires_at > datetime('now')"
  )
    .bind(c.req.header("Authorization")?.split(" ")[1] || "")
    .first();

  if (!session) {
    return c.json(
      {
        error: {
          code: "INVALID_SESSION",
          message: "セッションが無効です",
        },
      } satisfies ErrorResponse,
      401
    );
  }

  // レスポンス
  return c.json({
    data: {
      valid: true,
      userId: payload.user_id,
      expiresAt: payload.exp,
      // 必要に応じて追加情報
      role: payload.role,
    },
  } satisfies SuccessResponse<{
    valid: boolean;
    userId: number;
    expiresAt: number;
    role?: string;
  }>);
};
