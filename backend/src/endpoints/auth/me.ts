import { Context } from "hono";
import {
  Bindings,
  ErrorResponse,
  JwtPayload,
  SuccessResponse,
} from "../../types/types";

/**
 * 認証済みユーザーの情報を取得するハンドラ
 */
export const meHandler = async (
  c: Context<{ Bindings: Bindings; Variables: { jwtPayload?: JwtPayload } }>
): Promise<Response> => {
  try {
    // JWTペイロードを取得
    const payload = c.get("jwtPayload");
    if (!payload) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "認証が必要です",
          },
        } satisfies ErrorResponse,
        401
      );
    }

    // データベースからユーザー情報を取得
    const user = await c.env.DB.prepare(
      "SELECT id, email, name, role, created_at FROM users WHERE id = ?"
    )
      .bind(payload.user_id)
      .first<{
        id: number;
        email: string;
        name: string;
        role: string;
        created_at: string;
      }>();

    if (!user) {
      return c.json(
        {
          error: {
            code: "USER_NOT_FOUND",
            message: "ユーザーが見つかりません",
          },
        } satisfies ErrorResponse,
        404
      );
    }

    // ユーザー情報を返す
    return c.json(
      {
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: user.created_at,
        },
      } satisfies SuccessResponse,
      200
    );
  } catch (error) {
    console.error("Get user error:", error);
    return c.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "ユーザー情報の取得に失敗しました",
        },
      } satisfies ErrorResponse,
      500
    );
  }
};
