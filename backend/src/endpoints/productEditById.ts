// backend/src/endpoints/productEditById.ts
import { Context } from "hono";
import {
  Bindings,
  ErrorResponse,
  ProductCreateResponse,
  JwtPayload,
} from "../types/types";
import { productSchema } from "../schemas/product";
import { uploadToR2, deleteFromR2 } from "../lib/storage";

// productGetById.tsと完全一致するレスポンス型
type ProductResponse = {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  category_id: number | null;
  created_at: string;
  images: {
    main: { id: number; url: string; is_main: true };
    additional: { id: number; url: string; is_main: false }[];
  };
};

export const productEditByIdHandler = async (
  c: Context<{ Bindings: Bindings; Variables: { jwtPayload?: JwtPayload } }>
): Promise<Response> => {
  const productId = c.req.param("id");
  const db = c.env.DB;

  // 🌟 トランザクション追跡用ID生成
  const traceId = Math.random().toString(36).substr(2, 9);
  console.log(`[${traceId}] 商品更新プロセス開始`, new Date().toISOString());
  try {
    // 認証チェック (productCreate.tsと同一ロジック)
    const payload = c.get("jwtPayload");
    if (!payload || payload.role !== "admin") {
      return c.json(
        {
          error: {
            code: !payload ? "UNAUTHORIZED" : "FORBIDDEN",
            message: !payload
              ? "認証が必要です"
              : "商品編集には管理者権限が必要です",
          },
        } satisfies ErrorResponse,
        !payload ? 401 : 403
      );
    }

    const formData = await c.req.formData();

    // バックエンドログの強化: 受信したFormDataの構造をログ出力
    console.log("受信したFormData:", {
      mainImage: formData.get("mainImage")?.constructor.name,
      additionalImages: formData
        .getAll("additionalImages")
        .map((i) => i?.constructor.name),
      keepImageIds: formData.getAll("keepImageIds"),
      otherFields: {
        name: formData.get("name"),
        description: formData.get("description"),
        price: formData.get("price"),
        stock: formData.get("stock"),
        category_id: formData.get("category_id"),
      },
    });

    // フォームデータの前処理 (productCreate.tsと同形式)
    const rawFormData = {
      name: formData.get("name"),
      description: formData.get("description"),
      price: formData.get("price"),
      stock: formData.get("stock") || 0,
      category_id: formData.get("category_id"),
    };

    // バリデーション (productCreate.tsと同一スキーマ)
    const validationResult = productSchema.safeParse(rawFormData);
    if (!validationResult.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "入力内容に誤りがあります",
            details: validationResult.error.flatten(),
          },
        } satisfies ErrorResponse,
        400
      );
    }

    // データベース操作にトレースIDを追加
    const traceId = Math.random().toString(36).substr(2, 9);
    console.log(`[${traceId}] 商品更新開始`, new Date().toISOString());

    // 既存商品の取得 (productGetById.tsと同クエリ)
    const existingProduct = await db
      .prepare("SELECT id FROM products WHERE id = ?")
      .bind(productId)
      .first<{ id: number }>();

    if (!existingProduct) {
      return c.json(
        {
          error: {
            code: "PRODUCT_NOT_FOUND",
            message: "編集対象の商品が見つかりません",
          },
        } satisfies ErrorResponse,
        404
      );
    }

    // 画像処理 ==============================================
    const mainImageRaw = formData.get("mainImage") as string | File | null;
    let mainImageUrl: string | undefined;

    // メイン画像処理の強化
    if (mainImageRaw instanceof File) {
      // 新規アップロード
      if (!mainImageRaw.size) {
        return c.json({ error: "空の画像ファイル" }, 400);
      }
      // 古いメイン画像を取得
      const oldMainImage = await db
        .prepare(
          "SELECT id, image_url FROM images WHERE product_id = ? AND is_main = 1"
        )
        .bind(productId)
        .first<{ id: number; image_url: string }>();

      // 新しい画像をアップロード
      const uploadResult = await uploadToR2(
        c.env.R2_BUCKET,
        mainImageRaw,
        c.env.R2_PUBLIC_DOMAIN,
        { folder: "products/main" }
      );
      mainImageUrl = uploadResult.url;

      // 古い画像を削除
      if (oldMainImage?.image_url) {
        await deleteFromR2(c.env.R2_BUCKET, oldMainImage.image_url);
      }

      // データベース更新
      await db
        .prepare(
          "UPDATE images SET image_url = ? WHERE product_id = ? AND is_main = 1"
        )
        .bind(mainImageUrl, productId)
        .run();
    } else if (typeof mainImageRaw === "string") {
      // 既存画像を保持
      mainImageUrl = mainImageRaw;
    }

    // 追加画像処理のロバスト化
    const additionalImages = formData.getAll("additionalImages") as (
      | File
      | string
    )[];
    const validAdditionalImages = additionalImages.filter(
      (img): img is File => img instanceof File
    );
    let additionalImageUrls: string[] = [];

    if (validAdditionalImages.length > 0) {
      additionalImageUrls = (
        await Promise.all(
          validAdditionalImages.map((file) =>
            uploadToR2(c.env.R2_BUCKET, file, c.env.R2_PUBLIC_DOMAIN, {
              folder: "products/additional",
            })
          )
        )
      ).map((result) => result.url);

      // 新しい追加画像を挿入
      await db.batch(
        additionalImageUrls.map((url) =>
          db
            .prepare(
              "INSERT INTO images (product_id, image_url, is_main) VALUES (?, ?, 0)"
            )
            .bind(productId, url)
        )
      );
    }

    // 既存画像IDを保持 (削除対象判定用)
    const keepImageIds = formData.getAll("keepImageIds") as string[];

    // 不要な画像の削除 (keepImageIdsに含まれないもの)
    if (keepImageIds.length > 0) {
      const placeholders = keepImageIds.map(() => "?").join(",");
      const deleteQuery = await db
        .prepare(
          `SELECT id, image_url FROM images 
         WHERE product_id = ? 
         AND is_main = 0 
         AND id NOT IN (${placeholders})`
        )
        .bind(productId, ...keepImageIds);

      const toDelete = await deleteQuery.all<{
        id: number;
        image_url: string;
      }>();

      if (toDelete.results.length > 0) {
        console.log(`削除対象の追加画像: ${toDelete.results.length}件`);
        // R2から削除
        await Promise.all(
          toDelete.results.map((img) =>
            deleteFromR2(c.env.R2_BUCKET, img.image_url)
          )
        );
        // DBから削除
        await db
          .prepare(
            `DELETE FROM images WHERE id IN (${toDelete.results
              .map((img) => img.id)
              .join(",")})`
          )
          .run();
      }
    }

    // 商品基本情報更新 =======================================
    await db
      .prepare(
        `UPDATE products SET
          name = ?,
          description = ?,
          price = ?,
          stock = ?,
          category_id = ?
        WHERE id = ?`
      )
      .bind(
        validationResult.data.name,
        validationResult.data.description,
        validationResult.data.price,
        validationResult.data.stock,
        validationResult.data.category_id,
        productId
      )
      .run();

    // 更新後の商品情報取得 (productGetById.tsと同一クエリ)
    const updatedProduct = await db
      .prepare(
        `SELECT 
          p.id, p.name, p.description, p.price, p.stock,
          p.category_id, c.name as category_name,
          p.created_at
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = ?`
      )
      .bind(productId)
      .first<ProductResponse>();

    const images = await db
      .prepare(
        `SELECT id, image_url as url, is_main
         FROM images
         WHERE product_id = ?
         ORDER BY is_main DESC, created_at ASC`
      )
      .bind(productId)
      .all<{
        id: number;
        url: string;
        is_main: number;
      }>();

    // レスポンス構築 (productGetById.tsと同一構造)
    const mainImage = images.results.find((img) => img.is_main === 1);
    if (!mainImage) {
      throw new Error("メイン画像が存在しません");
    }

    const response: ProductResponse = {
      ...updatedProduct,
      images: {
        main: {
          id: mainImage.id,
          url: mainImage.url,
          is_main: true,
        },
        additional: images.results
          .filter((img) => img.is_main === 0)
          .map((img) => ({
            id: img.id,
            url: img.url,
            is_main: false,
          })),
      },
    };

    // 処理結果のログ出力
    console.log("商品更新成功:", {
      productId,
      mainImageUpdated: mainImageRaw instanceof File,
      additionalImagesUploaded: additionalImageUrls.length,
      imagesDeleted: keepImageIds.length > 0 ? "一部削除" : "なし",
    });

    return c.json(response);
  } catch (error) {
    console.error("[PRODUCT_UPDATE_ERROR]", error);
    return c.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            error instanceof Error ? error.message : "商品の更新に失敗しました",
        },
      } satisfies ErrorResponse,
      500
    );
  }
};
