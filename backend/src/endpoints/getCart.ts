import { Context } from 'hono';
import { Bindings, CartItem, ErrorResponse, JwtPayload } from '../types';

export const getCartHandler = async (
  c: Context<{ 
    Bindings: Bindings,
    Variables: { jwtPayload?: JwtPayload } 
  }>
): Promise<Response> => {
  const payload = c.get('jwtPayload');
  const user_id = payload?.user_id;
  const sessionId = c.req.header('x-session-id');

  // バリデーション
  if (!user_id && !sessionId) {
    return c.json({
      error: { 
        message: 'セッションIDまたは認証が必要です',
        details: { 
          required: ['x-session-id', 'jwt'],
          received: { hasSessionId: !!sessionId, hasJWT: !!user_id }
        },
        solution: '認証トークンを提供するか、セッションIDをヘッダーに含めてください'
      }
    } satisfies ErrorResponse, 400);
  }

  try {
    // クエリ構築
    const conditions = [];
    const binds = [];
    
    if (user_id) {
      conditions.push('ci.user_id = ?');
      binds.push(user_id);
    }
    
    if (sessionId) {
      conditions.push('ci.session_id = ?');
      binds.push(sessionId);
    }

    const { results } = await c.env.DB.prepare(`
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
      WHERE ${conditions.join(' OR ')}
    `).bind(...binds).all<CartItem>();

    // カート統合（ユーザーIDとセッションIDの両方がある場合）
    if (user_id && sessionId) {
      await mergeCarts(c.env.DB, user_id, sessionId);
    }

    return c.json(results);
  } catch (error) {
    console.error('カート取得エラー:', error);
    return c.json({
      error: { 
        message: 'サーバー内部エラー',
        ...(c.env.ENVIRONMENT === 'development' && {
          details: error instanceof Error ? error.message : String(error)
        })
      }
    } satisfies ErrorResponse, 500);
  }
};

// カート統合関数
async function mergeCarts(db: D1Database, user_id: number, session_id: string): Promise<void> {
  try {
    await db.batch([
      // セッションカートをユーザーカートに移動
      db.prepare(`
        UPDATE cart_items 
        SET user_id = ?, session_id = NULL 
        WHERE session_id = ? AND user_id IS NULL
      `).bind(user_id, session_id),
      
      // 重複アイテムの削除
      db.prepare(`
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
      `).bind(user_id, user_id)
    ]);
  } catch (error) {
    console.error('カート統合エラー:', error);
    throw new Error('カートの統合に失敗しました');
  }
}
