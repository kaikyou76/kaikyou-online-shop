import { Context } from "hono";

type Bindings = {
  DB: D1Database;
};

export const productGetByIdHandler = async (c: Context<{ Bindings: Bindings }>) => {
  const id = c.req.param("id");

  try {
    const stmt = c.env.DB.prepare(
      `SELECT p.*, c.name as category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ?`
    );
    const result = await stmt.bind(id).first();

    if (!result) {
      return c.json({ error: "指定された商品が見つかりません" }, 404);
    }

    return c.json(result);
  } catch (error) {
    console.error("Error fetching product by ID:", error);
    return c.json({ error: "サーバーエラーが発生しました" }, 500);
  }
};
