import { Hono } from "hono";
import { productPostHandler } from "endpoints/productCreate";
import { productGetHandler } from "endpoints/productGet";


type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS ミドルウェア（全ルート適用）
app.use('*', async (c, next) => {
  if (c.req.method === 'OPTIONS') {
    return c.newResponse('', {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization',

      },
    });
  }
  await next();
  c.header('Access-Control-Allow-Origin', '*');
});


// 商品関連API（/products を含むため /apiにマウント）
app.post('/api/products', productPostHandler);
app.get('/api/products', productGetHandler);




export default app;