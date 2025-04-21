import { Context } from "hono";

type Bindings = {
  DB: D1Database;
};

export const productGetHandler = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM products').all();
    return c.json(results);
  } catch (error) {
    console.error('Error fetching products:', error);
    return c.json({ error: 'サーバーエラーが発生しました' }, 500);
  }
};

