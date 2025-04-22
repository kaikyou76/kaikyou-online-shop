import { MiddlewareHandler } from "hono";
import { jwtVerify } from "jose";
import { Env, JwtPayload } from "../types/types";

export const jwtMiddleware: MiddlewareHandler<{
  Bindings: Env;
  Variables: {
    jwtPayload?: JwtPayload;
  };
}> = async (c, next) => {
  // 1. Authorization ヘッダーの検証
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    c.status(401);
    c.header("WWW-Authenticate", "Bearer");
    c.header("X-Content-Type-Options", "nosniff");
    return c.json({
      success: false,
      error: {
        code: "INVALID_AUTH_HEADER",
        message: "Authorization: Bearer <token> 形式が必要です",
      },
    });
  }

  // 2. トークンの抽出と検証
  const token = authHeader.split(" ")[1];
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(c.env.JWT_SECRET),
      {
        issuer: c.env.JWT_ISSUER,
        audience: c.env.JWT_AUDIENCE,
        clockTolerance: 15,
        algorithms: ["HS256"],
        maxTokenAge: "2h",
      }
    );

    // 3. ペイロードの必須項目確認
    if (!payload.user_id || !payload.email) {
      throw new Error("Invalid JWT payload: missing user_id or email");
    }

    // 4. Context にユーザー情報を保存
    c.set("jwtPayload", {
      user_id: payload.user_id as number,
      email: payload.email as string,
      exp: payload.exp as number,
    });

    await next();
  } catch (error) {
    // 5. 認証エラー時のレスポンス
    c.status(401);
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Cache-Control", "no-store");
    return c.json({
      success: false,
      error: {
        code: "AUTH_FAILURE",
        message: "認証に失敗しました",
        ...(c.env.ENVIRONMENT === "development" && {
          details: error instanceof Error ? error.message : String(error),
        }),
      },
    });
  }
};
