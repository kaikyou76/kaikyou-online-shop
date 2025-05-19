// backend/src/endpoints/auth/login.ts
import { Context } from "hono";
import {
  Bindings,
  ErrorResponse,
  LoginResponseData,
  SuccessResponse,
} from "../../types/types";
import { generateAuthToken, verifyPassword } from "../../middleware/jwt";
import { z } from "zod";
import { nanoid } from "nanoid"; // 追加

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const loginHandler = async (
  c: Context<{ Bindings: Bindings }>
): Promise<Response> => {
  try {
    const rawJson = await c.req.json();
    const validationResult = loginSchema.safeParse(rawJson);

    if (!validationResult.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "メールアドレスとパスワードを正しく入力してください",
          },
        } satisfies ErrorResponse,
        400
      );
    }

    const { email, password } = validationResult.data;

    // ユーザー取得
    const user = await c.env.DB.prepare(
      "SELECT id, email, password_hash, name, role FROM users WHERE email = ?"
    )
      .bind(email)
      .first<{
        id: number;
        email: string;
        password_hash: string;
        name: string;
        role: string;
      }>();

    if (!user) {
      return c.json(
        {
          error: {
            code: "INVALID_CREDENTIALS",
            message: "メールアドレスまたはパスワードが正しくありません",
          },
        } satisfies ErrorResponse,
        401
      );
    }

    // パスワード検証
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return c.json(
        {
          error: {
            code: "INVALID_CREDENTIALS",
            message: "メールアドレスまたはパスワードが正しくありません",
          },
        } satisfies ErrorResponse,
        401
      );
    }

    // トークン生成（既存ロジック）
    const token = await generateAuthToken(
      c.env,
      user.id, // userId: number
      user.email, // email: string
      user.role, // role: string
      "2h" // 有効期限
    );

    // === 追加: セッション情報をDBに保存 ===
    const sessionToken = nanoid(32); // セッション用トークン生成
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2時間後
    const userAgent = c.req.header("user-agent") || "unknown";
    const ipAddress = c.req.header("cf-connecting-ip") || "unknown";

    await c.env.DB.prepare(
      `INSERT INTO sessions (
        user_id,
        session_token,
        jwt_token,
        expires_at,
        user_agent,
        ip_address
      ) VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(user.id, sessionToken, token, expiresAt, userAgent, ipAddress)
      .run();

    // レスポンス（既存の形式を維持）
    return c.json(
      {
        data: {
          token, // クライアントにはJWTのみ返す（セッショントークンはHTTP-Only Cookieなど別途設定推奨）
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        },
      } satisfies SuccessResponse<LoginResponseData>,
      200
    );
  } catch (error) {
    console.error("Login error:", error);
    return c.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "ログイン処理に失敗しました",
        },
      } satisfies ErrorResponse,
      500
    );
  }
};
