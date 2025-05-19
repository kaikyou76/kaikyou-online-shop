// backend/src/endpoints/users/deleteUser.ts
import { Context } from "hono";
import {
  Bindings,
  ErrorResponse,
  SuccessResponse,
  JwtPayload,
} from "../../types/types";

export const deleteUserHandler = async (
  c: Context<{ Bindings: Bindings; Variables: { jwtPayload?: JwtPayload } }>
) => {
  try {
    // IDバリデーション
    const userId = parseInt(c.req.param("id"));
    if (isNaN(userId))
      return c.json(
        { error: { code: "INVALID_ID", message: "無効なユーザーIDです" } },
        400
      );

    // 認証チェック
    const payload = c.get("jwtPayload");
    if (!payload)
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "認証が必要です" } },
        401
      );

    // 管理者権限チェック
    const isAdmin = await c.env.DB.prepare(
      "SELECT 1 FROM users WHERE id = ? AND role = 'admin'"
    )
      .bind(payload.user_id)
      .first()
      .then(Boolean);
    if (!isAdmin)
      return c.json(
        { error: { code: "FORBIDDEN", message: "管理者権限が必要です" } },
        403
      );

    // 自己削除防止
    if (payload.user_id === userId)
      return c.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "自分自身のアカウントは削除できません",
          },
        },
        403
      );

    // ユーザー存在確認
    const userExists = await c.env.DB.prepare(
      "SELECT 1 FROM users WHERE id = ?"
    )
      .bind(userId)
      .first()
      .then(Boolean);
    if (!userExists)
      return c.json(
        {
          error: {
            code: "USER_NOT_FOUND",
            message: "ユーザーが見つかりません",
          },
        },
        404
      );

    // トランザクション実行
    const result = await c.env.DB.batch([
      c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId),
      c.env.DB.prepare("DELETE FROM cart_items WHERE user_id = ?").bind(userId),
      c.env.DB.prepare("DELETE FROM reviews WHERE user_id = ?").bind(userId),
      c.env.DB.prepare("DELETE FROM wishlists WHERE user_id = ?").bind(userId),
      c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId),
    ]);

    return c.json(
      {
        data: {
          success: true,
          affectedRows: result.filter((r) => r.success).length,
        },
      },
      200
    );
  } catch (error) {
    console.error("Delete user error:", error);
    return c.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "ユーザーの削除に失敗しました",
        },
      },
      500
    );
  }
};
