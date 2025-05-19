// backend/src/endpoints/users/updateUser.ts
import { Context } from "hono";
import {
  Bindings,
  ErrorResponse,
  SuccessResponse,
  JwtPayload,
} from "../../types/types";
import { z } from "zod";

const updateUserSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  email: z.string().email().optional(),
  role: z.enum(["user", "admin"]).optional(),
});

export const updateUserHandler = async (
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

    // 権限チェック
    if (payload.user_id !== userId) {
      const isAdmin = await c.env.DB.prepare(
        "SELECT 1 FROM users WHERE id = ? AND role = 'admin'"
      )
        .bind(payload.user_id)
        .first()
        .then(Boolean);
      if (!isAdmin)
        return c.json(
          { error: { code: "FORBIDDEN", message: "更新権限がありません" } },
          403
        );
    }

    // リクエストバリデーション
    const { data, success, error } = updateUserSchema.safeParse(
      await c.req.json()
    );
    if (!success)
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "入力内容に誤りがあります",
            issues: error.errors,
          },
        },
        400
      );

    // 本人がroleを変更しようとした場合
    if (data.role && payload.user_id === userId) {
      return c.json(
        { error: { code: "FORBIDDEN", message: "自身の権限は変更できません" } },
        403
      );
    }

    // メールアドレス重複チェック
    if (data.email) {
      const existingUser = await c.env.DB.prepare(
        "SELECT 1 FROM users WHERE email = ? AND id != ?"
      )
        .bind(data.email, userId)
        .first();
      if (existingUser)
        return c.json(
          {
            error: {
              code: "EMAIL_EXISTS",
              message: "このメールアドレスは既に使用されています",
            },
          },
          409
        );
    }

    // 更新フィールド構築
    const updates = [];
    const values = [];
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }
    if (updates.length === 0)
      return c.json(
        { error: { code: "NO_UPDATES", message: "更新する内容がありません" } },
        400
      );

    // データベース更新
    await c.env.DB.prepare(
      `UPDATE users SET ${updates.join(", ")} WHERE id = ?`
    )
      .bind(...values, userId)
      .run();

    // 更新後のデータ取得
    const updatedUser = await c.env.DB.prepare(
      "SELECT id, email, name, role, created_at FROM users WHERE id = ?"
    )
      .bind(userId)
      .first();

    return c.json({ data: updatedUser }, 200);
  } catch (error) {
    console.error("Update user error:", error);
    return c.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "ユーザー情報の更新に失敗しました",
        },
      },
      500
    );
  }
};
