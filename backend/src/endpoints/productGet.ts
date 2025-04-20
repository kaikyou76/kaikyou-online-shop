import { fromHono } from "chanfana";
import { z } from "zod";
import { Hono } from "hono";

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

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
