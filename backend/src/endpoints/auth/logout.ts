//backend/src/endpoints/auth/logout.ts
import { Context } from "hono";
import { Bindings, ErrorResponse, SuccessResponse } from "../../types/types";

export const logoutHandler = async (
  c: Context<{ Bindings: Bindings }>
): Promise<Response> => {
  try {
    const authHeader = c.req.header("Authorization");
    const sessionToken = authHeader?.split(" ")[1];

    if (sessionToken) {
      // セッション削除
      await c.env.DB.prepare("DELETE FROM sessions WHERE session_token = ?")
        .bind(sessionToken)
        .run();
    }

    return c.json({ data: { success: true } } satisfies SuccessResponse, 200);
  } catch (error) {
    console.error("Logout error:", error);
    return c.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "ログアウト処理に失敗しました",
        },
      } satisfies ErrorResponse,
      500
    );
  }
};
