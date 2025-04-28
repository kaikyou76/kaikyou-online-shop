//backend/src/schemas/product.ts
import { z } from "zod";

export const productSchema = z
  .object({
    name: z.preprocess(
      (val) => val?.toString().trim(),
      z
        .string()
        .min(1, "商品名は必須です")
        .max(100, "商品名は100文字以内で入力してください")
    ),
    description: z.preprocess(
      (val) => val?.toString().trim(),
      z
        .string()
        .max(1000, "説明文は1000文字以内で入力してください")
        .optional()
        .transform((val) => val || null)
    ),
    price: z.preprocess(
      (val) => Number(val),
      z
        .number()
        .int("価格は整数で入力してください")
        .positive("正の値を指定してください")
    ),
    stock: z.preprocess(
      (val) => Number(val || 0),
      z
        .number()
        .int("在庫数は整数で入力してください")
        .min(0, "在庫数は0以上の値を指定してください")
        .default(0)
    ),
    category_id: z.preprocess(
      (val) => (val === null || val === "" ? null : Number(val)),
      z
        .number()
        .int("カテゴリIDは整数で入力してください")
        .positive("カテゴリIDは正の値を指定してください")
        .nullable()
        .optional()
    ),
  })
  .strict();

export type ProductSchema = z.infer<typeof productSchema>;
