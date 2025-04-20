import { fromHono } from "chanfana";
import { z } from "zod";
import { Hono } from "hono";

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

app.post("/products", async (c) => {
  const bodySchema = z.object({
    name: z.string().min(1, "商品名は必須です"),
    description: z.string().optional(),
    price: z.number().positive("正の値を指定してください"),
    stock: z.number().int().nonnegative().default(0),
    category_id: z.number().int().optional(),
    image_url: z.string().url("有効なURLを指定してください").optional(),
  }).strict();

  try {
    const validated = bodySchema.safeParse(await c.req.json());

    if (!validated.success) {
      return c.json({ error: validated.error.flatten() }, 400);
    }

    const { name, description, price, image_url, stock, category_id } = validated.data;

    const result = await c.env.DB.prepare(`
      INSERT INTO products 
        (name, description, price, image_url, stock, category_id)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING id, name, price, stock;
    `)
      .bind(name, description, price, image_url, stock, category_id)
      .first();

    return c.json(result, 201);
  } catch (error) {
    console.error("商品登録失敗:", error);
    return c.json({ error: "商品登録に失敗しました" }, 500);
  }
});

export default app;
