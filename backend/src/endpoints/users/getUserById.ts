import { Context } from "hono";
import {
  Bindings,
  ErrorResponse,
  SuccessResponse,
  JwtPayload,
} from "../../types/types";

export const getUserByIdHandler = async (
  c: Context<{ Bindings: Bindings; Variables: { jwtPayload?: JwtPayload } }>
): Promise<Response> => {
  try {
    // IDバリデーション
    const userId = parseInt(c.req.param("id"));
    if (isNaN(userId)) {
      return c.json(
        {
          error: { code: "INVALID_ID", message: "無効なユーザーIDです" },
        } satisfies ErrorResponse,
        400
      );
    }

    // 認証チェック
    const payload = c.get("jwtPayload");
    if (!payload) {
      return c.json(
        {
          error: { code: "UNAUTHORIZED", message: "認証が必要です" },
        } satisfies ErrorResponse,
        401
      );
    }

    // 権限チェック（本人または管理者のみ許可）
    if (payload.user_id !== userId) {
      const isAdmin = await c.env.DB.prepare(
        "SELECT 1 FROM users WHERE id = ? AND role = 'admin'"
      )
        .bind(payload.user_id)
        .first()
        .then(Boolean);

      if (!isAdmin) {
        return c.json(
          {
            error: { code: "FORBIDDEN", message: "アクセス権限がありません" },
          } satisfies ErrorResponse,
          403
        );
      }
    }

    // ユーザー情報取得
    const user = await c.env.DB.prepare(
      "SELECT id, email, name, role, created_at FROM users WHERE id = ?"
    )
      .bind(userId)
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
    console.error("Get user by ID error:", error);
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
