import { fromHono } from "chanfana";
import { Hono } from "hono";
import { TaskCreate } from "./endpoints/taskCreate";
import { TaskDelete } from "./endpoints/taskDelete";
import { TaskFetch } from "./endpoints/taskFetch";
import { TaskList } from "./endpoints/taskList";

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

// OpenAPIドキュメント生成設定
const openapi = fromHono(app, {
  docs_url: "/",
});

// OpenAPI経由で登録するルート
openapi.get("/api/tasks", TaskList);
openapi.post("/api/tasks", TaskCreate);
openapi.get("/api/tasks/:taskSlug", TaskFetch);
openapi.delete("/api/tasks/:taskSlug", TaskDelete);

// 基本ルート（D1 Database接続例）
app.get('/api/products', async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM products').all();
    return c.json(results);
  } catch (error) {
    console.error('Error fetching products:', error);
    return c.json({ error: 'サーバーエラーが発生しました' }, 500);
  }
});

export default app;