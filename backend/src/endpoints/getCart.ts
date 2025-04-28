// backend/src/endpoints/getCart.ts
import { Context } from "hono";
import { Bindings, CartItem, ErrorResponse, JwtPayload } from "../types/types";

// メインハンドラー
export const getCartHandler = async (
  c: Context<{
    Bindings: Bindings;
    Variables: { jwtPayload?: JwtPayload };
  }>
): Promise<Response> => {
  try {
    const { user_id, sessionId } = getAuthInfo(c);

    if (!user_id && !sessionId) {
      return invalidSessionResponse(c, {
        hasSessionId: !!sessionId,
        hasJWT: !!user_id,
      });
    }

    // カート統合（ユーザーIDとセッションIDの両方がある場合）
    if (user_id && sessionId) {
      await mergeCarts(c.env.DB, user_id, sessionId);
    }

    const cartItems = await fetchCartItems(c, user_id, sessionId);

    return c.json(cartItems);
  } catch (error) {
    console.error("カート取得エラー:", error);
    return c.json(
      {
        error: {
          code: "SERVER_ERROR",
          message: "サーバー内部エラー",
          meta:
            c.env.ENVIRONMENT === "development"
              ? {
                  errorMessage:
                    error instanceof Error ? error.message : String(error),
                }
              : undefined,
        },
      } satisfies ErrorResponse,
      500
    );
  }
};

// 認証情報を取得
export const getAuthInfo = (
  c: Context<{ Bindings: Bindings; Variables: { jwtPayload?: JwtPayload } }>
) => {
  const payload = c.get("jwtPayload");
  const user_id = payload?.user_id;
  const sessionId = c.req.header("x-session-id") || undefined;

  return { user_id, sessionId };
};

// 認証エラー時のレスポンス
function invalidSessionResponse(
  c: Context,
  received: { hasSessionId: boolean; hasJWT: boolean }
) {
  return c.json(
    {
      error: {
        code: "INVALID_SESSION",
        message: "セッションIDまたは認証が必要です",
        details: {
          formErrors: [],
          fieldErrors: {
            name: ["商品名は必須です", "商品名は100文字以内で入力してください"],
            description: ["説明文は1000文字以内で入力してください"],
            price: ["価格は整数で入力してください", "正の値を指定してください"],
            stock: [
              "在庫数は整数で入力してください",
              "在庫数は0以上の値を指定してください",
            ],
            category_id: [
              "カテゴリIDは整数で入力してください",
              "カテゴリIDは正の値を指定してください",
            ],
          },
        },
        meta: {
          required: ["x-session-id", "jwt"],
          received,
        },
        solution:
          "認証トークンを提供するか、セッションIDをヘッダーに含めてください",
      },
    } satisfies ErrorResponse,
    400
  );
}

// カート情報を取得
export const fetchCartItems = async (
  c: Context<{ Bindings: Bindings; Variables: { jwtPayload?: JwtPayload } }>,
  user_id?: number,
  sessionId?: string
): Promise<CartItem[]> => {
  const conditions = [];
  const binds = [];

  if (user_id) {
    conditions.push("ci.user_id = ?");
    binds.push(user_id);
  }

  if (sessionId) {
    conditions.push("ci.session_id = ?");
    binds.push(sessionId);
  }

  const { results } = await c.env.DB.prepare(
    `
    SELECT 
      ci.id,
      p.id as product_id,
      p.name,
      p.price,
      p.image_url,
      ci.quantity,
      (p.price * ci.quantity) as subtotal
    FROM cart_items ci
    JOIN products p ON ci.product_id = p.id
    WHERE ${conditions.join(" OR ")}
  `
  )
    .bind(...binds)
    .all<CartItem>();

  return results;
};

// カート統合処理
async function mergeCarts(
  db: D1Database,
  user_id: number,
  session_id: string
): Promise<void> {
  try {
    await db.batch([
      db
        .prepare(
          `
          UPDATE cart_items 
          SET user_id = ?, session_id = NULL 
          WHERE session_id = ? AND user_id IS NULL
        `
        )
        .bind(user_id, session_id),

      db
        .prepare(
          `
          DELETE FROM cart_items 
          WHERE id IN (
            SELECT ci.id
            FROM cart_items ci
            JOIN (
              SELECT product_id, MIN(id) as min_id
              FROM cart_items
              WHERE user_id = ?
              GROUP BY product_id
              HAVING COUNT(*) > 1
            ) dup ON ci.product_id = dup.product_id AND ci.id != dup.min_id
            WHERE ci.user_id = ?
          )
        `
        )
        .bind(user_id, user_id),
    ]);
  } catch (error) {
    console.error("カート統合エラー:", error);
    throw new Error("カートの統合に失敗しました");
  }
}
