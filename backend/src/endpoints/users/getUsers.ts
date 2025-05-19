// backend/src/endpoints/users/getUsers.ts
import { Context } from "hono";
import {
  Bindings,
  ErrorResponse,
  SuccessResponse,
  JwtPayload,
} from "../../types/types";

export const getUsersHandler = async (
  c: Context<{
    Bindings: Bindings;
    Variables: { jwtPayload: JwtPayload };
  }>
) => {
  try {
    // 管理者権限チェック（ハンドラ内で直接実装）
    const payload = c.get("jwtPayload");
    if (!payload) {
      return c.json(
        {
          error: { code: "UNAUTHORIZED", message: "認証が必要です" },
        } satisfies ErrorResponse,
        401
      );
    }

    // 権限チェック
    const userRole = await c.env.DB.prepare(
      "SELECT role FROM users WHERE id = ? LIMIT 1"
    )
      .bind(payload.user_id)
      .first<{ role: string }>()
      .then((result) => result?.role);

    if (userRole !== "admin") {
      return c.json(
        {
          error: { code: "FORBIDDEN", message: "管理者権限が必要です" },
        } satisfies ErrorResponse,
        403
      );
    }

    // クエリパラメータの取得
    const page = Math.max(1, parseInt(c.req.query("page") || "1"));
    const perPage = Math.max(1, parseInt(c.req.query("per_page") || "20"));

    // 総件数とデータを並列取得
    const [total, users] = await Promise.all([
      c.env.DB.prepare("SELECT COUNT(*) as count FROM users")
        .first<{ count: number }>()
        .then((res) => res?.count || 0),

      c.env.DB.prepare(
        `SELECT id, email, name, role, created_at 
         FROM users 
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      )
        .bind(perPage, (page - 1) * perPage)
        .all<{
          id: number;
          email: string;
          name: string;
          role: string;
          created_at: string;
        }>(),
    ]);

    return c.json(
      {
        data: users.results.map((user) => ({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: user.created_at,
        })),
        meta: {
          page,
          per_page: perPage,
          total,
          total_pages: Math.ceil(total / perPage),
        },
      } satisfies SuccessResponse,
      200
    );
  } catch (error) {
    console.error("Get users error:", error);
    return c.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "ユーザー一覧の取得に失敗しました",
        },
      } satisfies ErrorResponse,
      500
    );
  }
};
