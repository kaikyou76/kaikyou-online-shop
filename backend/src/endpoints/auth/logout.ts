import { Context } from "hono";
import { Bindings, ErrorResponse, SuccessResponse } from "../../types/types";

export const logoutHandler = async (
  c: Context<{ Bindings: Bindings }>
): Promise<Response> => {
  try {
    const authHeader = c.req.header("Authorization");

    // Authorizationヘッダの形式チェック
    if (!authHeader?.startsWith("Bearer ")) {
      c.status(401);
      c.header("WWW-Authenticate", "Bearer");
      c.header("X-Content-Type-Options", "nosniff");
      return c.json({
        error: {
          code: "INVALID_AUTH_HEADER",
          message: "Authorization: Bearer <token> 形式が必要です",
          ...(c.env.ENVIRONMENT === "development" && {
            meta: {
              errorMessage: "Missing or malformed Authorization header",
            },
          }),
        },
      } satisfies ErrorResponse);
    }

    const sessionToken = authHeader.split(" ")[1];

    // jwtPayloadがない、または不正な場合は 401 を返す
    const jwtPayload = c.get("jwtPayload");
    if (!jwtPayload || typeof jwtPayload !== "object") {
      c.status(401);
      c.header("WWW-Authenticate", 'Bearer error="invalid_token"');
      c.header("X-Content-Type-Options", "nosniff");
      return c.json({
        error: {
          code: "INVALID_TOKEN",
          message: "無効なアクセストークンです",
          ...(c.env.ENVIRONMENT === "development" && {
            meta: {
              errorMessage: "JWT payload is missing or invalid",
            },
          }),
        },
      } satisfies ErrorResponse);
    }

    // セッション削除処理
    const result = await c.env.DB.prepare(
      "DELETE FROM sessions WHERE session_token = ?"
    )
      .bind(sessionToken)
      .run();

    if (!result.success) {
      throw new Error("Failed to delete session");
    }

    return c.json(
      {
        data: { success: true },
      } satisfies SuccessResponse<{ success: boolean }>,
      200
    );
  } catch (error) {
    console.error("Logout error:", error);
    c.status(500);
    c.header("Cache-Control", "no-store");
    c.header("X-Content-Type-Options", "nosniff");
    return c.json({
      error: {
        code: "INTERNAL_ERROR",
        message: "ログアウト処理に失敗しました",
        ...(c.env.ENVIRONMENT === "development" && {
          meta: {
            errorMessage:
              error instanceof Error ? error.message : "Unknown error",
          },
        }),
      },
    } satisfies ErrorResponse);
  }
};
