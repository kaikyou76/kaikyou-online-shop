import { MiddlewareHandler } from 'hono';
import { jwtVerify } from 'jose';
import { JwtPayload } from 'types';

export const jwtMiddleware: MiddlewareHandler<{
  Bindings: {
    DB: D1Database;
    JWT_SECRET: string;
  };
  Variables: {
    jwtPayload?: JwtPayload;
  };
}> = async (c, next) => {
  // 1. Authorizationヘッダーからトークンを取得
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(
      { 
        error: { 
          message: '認証トークンが不足しています',
          code: 'AUTH_HEADER_MISSING' 
        } 
      },
      401
    );
  }

  const token = authHeader.split(' ')[1];

  try {
    // 2. JWTの検証
    const secret = new TextEncoder().encode(c.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, {
      issuer: 'your-issuer',
      audience: 'your-audience',
    });

    // 3. 型チェック付きでペイロードを検証
    if (!payload.user_id || !payload.email) {
      throw new Error('トークンペイロードが不正です');
    }

    // 4. コンテキストに認証情報を設定
    c.set('jwtPayload', {
      user_id: Number(payload.user_id),
      email: String(payload.email),
      exp: payload.exp ? Number(payload.exp) : undefined,
    });

    await next();
  } catch (error) {
    console.error('JWT検証エラー:', error);

    return c.json(
      { 
        error: { 
          message: '認証トークンが無効です',
          code: 'INVALID_TOKEN',
          details: process.env.NODE_ENV === 'development'
            ? { error: error instanceof Error ? error.message : String(error) }
            : undefined
        } 
      },
      401
    );
  }
};
