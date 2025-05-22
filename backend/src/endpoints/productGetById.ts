// backend/src/endpoints/productGet.ts
import { Context } from "hono";
import { Bindings } from "../types/types";

// 厳格な型定義（productCreate.tsと完全一致）
type Image = {
  id: number;
  url: string;
  is_main: number; // DBでは1（true）または0（false）
};

type ProductResponse = {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  category_id: number | null;
  category_name: string | null;
  created_at: string;
  images: {
    main: { id: number; url: string; is_main: true }; // nullを許容しない
    additional: { id: number; url: string; is_main: false }[];
  };
};

export const productGetByIdHandler = async (
  c: Context<{ Bindings: Bindings }>
) => {
  const id = c.req.param("id");

  try {
    // 商品基本情報取得（productCreate.tsのINSERT文と対称的なSELECT）
    const product = await c.env.DB.prepare(
      `
      SELECT 
        p.id, p.name, p.description, p.price, p.stock,
        p.category_id, c.name as category_name,
        p.created_at, p.created_at
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `
    )
      .bind(id)
      .first<ProductResponse>();

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

    // 画像情報取得（productCreate.tsのimagesテーブル構造に完全準拠）
    const images = await c.env.DB.prepare(
      `
      SELECT id, image_url as url, is_main
      FROM images
      WHERE product_id = ?
      ORDER BY is_main DESC, created_at ASC
    `
    )
      .bind(id)
      .all<Image>();

    // メイン画像の厳格なチェック（productCreate.tsの必須条件を反映）
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
        500 // データ不整合はサーバーエラーとして扱う
      );
    }

    // 追加画像（productCreate.tsのadditionalImages処理と対称）
    const additionalImages = images.results
      .filter((img) => img.is_main === 0)
      .map((img) => ({
        id: img.id,
        url: img.url,
        is_main: false as const,
      }));

    // レスポンス構築（productCreate.tsのPOSTレスポンスと完全一致）
    const response: ProductResponse = {
      ...product,
      images: {
        main: {
          id: mainImage.id,
          url: mainImage.url,
          is_main: true,
        },
        additional: additionalImages,
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
