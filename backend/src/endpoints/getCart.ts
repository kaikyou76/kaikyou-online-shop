// backend/src/endpoints/getCart.ts
import { Context } from 'hono';
import { Bindings, CartItem, ErrorResponse, JwtPayload } from 'types';

// レスポンス型の厳密な定義
type CartResponse = CartItem[] | ErrorResponse;

export const getCartHandler = async (
  c: Context<{ 
    Bindings: Bindings,
    Variables: { jwtPayload?: JwtPayload } 
  }>
): Promise<Response> => {
  // 認証情報の型安全な取得
  const payload = c.get('jwtPayload');
  const user_id = payload?.user_id;
  const sessionId = c.req.header('x-session-id');

  // バリデーション（ErrorResponse型に準拠）
  if (!user_id && !sessionId) {
    return c.json(
      { 
        error: { 
          message: 'セッションIDまたは認証が必要です',
          details: { 
            required: ['x-session-id', 'jwt'],
            received: { hasSessionId: !!sessionId, hasJWT: !!user_id }
          } 
        } 
      } satisfies ErrorResponse,
      400
    );
  }

  try {
    // 型安全なクエリ構築
    const whereClause = user_id ? 'ci.user_id = ?' : 'ci.session_id = ?';
    const mergeClause = user_id && sessionId ? 'OR ci.session_id = ?' : '';
    const query = `
      SELECT 
        p.id, p.name, p.price, p.image_url,
        ci.quantity,
        (p.price * ci.quantity) as subtotal
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ${whereClause} ${mergeClause}
    `;

    // 動的バインディング
    const binds = user_id ? [user_id] : [sessionId as string | number];
    if (user_id && sessionId) binds.push(sessionId);

    // 型付きクエリ実行
    const { results } = await c.env.DB.prepare(query)
      .bind(...binds)
      .all<CartItem>();

    // カート統合ロジック
    if (user_id && sessionId) {
      await mergeCarts(c.env.DB, user_id, sessionId);
    }

    return c.json(results satisfies CartItem[]);
  } catch (error) {
    console.error('カート取得エラー:', error);
    return c.json(
      { 
        error: { 
          message: 'サーバー内部エラー',
          details: process.env.NODE_ENV === 'development' 
            ? { error: error instanceof Error ? error.message : String(error) } 
            : undefined 
        } 
      } satisfies ErrorResponse,
      500
    );
  }
};

// カート統合関数（型安全に分離）
const mergeCarts = async (
  db: D1Database,
  user_id: number,
  session_id: string
): Promise<void> => {
  try {
    await db.batch([
      db.prepare(`
        UPDATE cart_items 
        SET user_id = ?, session_id = NULL 
        WHERE session_id = ?
      `).bind(user_id, session_id),
      
      db.prepare(`
        DELETE FROM cart_items 
        WHERE rowid NOT IN (
          SELECT MIN(rowid)
          FROM cart_items
          GROUP BY COALESCE(user_id, -1), product_id
        )
      `)
    ]);
  } catch (error) {
    console.error('カート統合エラー:', error);
    throw new Error('カートの統合に失敗しました');
  }
};
