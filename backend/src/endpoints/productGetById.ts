// backend/src/endpoints/productGetById.ts
import { Context } from "hono";
import { Bindings } from "../types/types";

// ======================
// 型定義 (DB層とAPI層を分離)
// ======================

/** DBから取得する生の画像型 */
type DBImage = {
  id: number;
  url: string;
  is_main: number; // 0 or 1
  created_at: string;
};

/** DBから取得する生の商品型 */
type DBProduct = {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  category_id: number | null;
  category_name: string | null;
  created_at: string;
};

/** APIレスポンス用の画像型 */
type APIImage = {
  id: number;
  url: string;
  is_main: boolean;
  uploaded_at: string;
};

/** APIレスポンス用の商品型 */
type APIProductResponse = {
  success: true;
  data: {
    id: number;
    name: string;
    description: string;
    price: number;
    stock: number;
    category_id: number | null;
    category_name: string | null;
    createdAt: string;
    images: {
      main: APIImage & { is_main: true };
      additional: (APIImage & { is_main: false })[];
    };
  };
};

// ======================
// 変換関数
// ======================

/** DB画像 → API画像に変換 */
const convertImage = (dbImage: DBImage): APIImage => ({
  id: dbImage.id,
  url: dbImage.url,
  is_main: dbImage.is_main === 1,
  uploaded_at: new Date(dbImage.created_at).toISOString(),
});

// ======================
// ハンドラー実装
// ======================

export const productGetByIdHandler = async (
  c: Context<{ Bindings: Bindings }>
) => {
  const id = c.req.param("id");

  try {
    // 商品基本情報取得
    const product = await c.env.DB.prepare(
      `
      SELECT 
        p.id, p.name, p.description, p.price, p.stock,
        p.category_id, c.name as category_name,
        p.created_at
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
      `
    )
      .bind(Number(id))
      .first<DBProduct>();

    if (!product) {
      return c.json(
        {
          error: {
            code: "PRODUCT_NOT_FOUND",
            message: "指定された商品が見つかりません",
          },
        },
        404
      );
    }

    // 画像情報取得
    const images = await c.env.DB.prepare(
      `
      SELECT 
        id, 
        image_url as url, 
        is_main,
        created_at
      FROM images
      WHERE product_id = ?
      ORDER BY is_main DESC, created_at ASC
      `
    )
      .bind(id)
      .all<DBImage>();

    // メイン画像チェック
    const mainImage = images.results.find((img) => img.is_main === 1);
    if (!mainImage) {
      return c.json(
        {
          error: {
            code: "DATA_INTEGRITY_ERROR",
            message: "商品データにメイン画像が存在しません（システムエラー）",
            details: {
              productId: id,
              storedImages: images.results.length,
            },
          },
        },
        500
      );
    }

    // レスポンス構築
    const response: APIProductResponse = {
      success: true,
      data: {
        ...product,
        createdAt: new Date(product.created_at).toISOString(),
        images: {
          main: {
            ...convertImage(mainImage),
            is_main: true,
          },
          additional: images.results
            .filter((img) => img.is_main === 0)
            .map((img) => ({
              ...convertImage(img),
              is_main: false,
            })),
        },
      },
    };

    return c.json(response);
  } catch (error) {
    console.error("[PRODUCT_FETCH_FAILED]", error);
    return c.json(
      {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "商品情報の取得に失敗しました",
          ...(error instanceof Error && { debug: error.message }),
        },
      },
      500
    );
  }
};
