// backend/src/endpoints/productEditById.ts
import { Context } from "hono";
import { Bindings, ErrorResponse, JwtPayload } from "../types/types";
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
  console.log(`[${traceId}] 🌟 商品更新プロセス開始`, new Date().toISOString());

  try {
    // 認証チェック
    const payload = c.get("jwtPayload");
    if (!payload || payload.role !== "admin") {
      console.log(`[${traceId}] 🌟 認証失敗:`, {
        hasPayload: !!payload,
        role: payload?.role,
      });
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

    // 🌟 フォームデータの詳細ログ
    console.log(`[${traceId}] 🌟 受信FormData:`, {
      keepImageIds: formData.getAll("keepImageIds"),
      additionalImagesCount: formData.getAll("additionalImages").length,
      mainImageType: formData.get("mainImage")?.constructor.name,
      otherFields: {
        name: formData.get("name"),
        description: formData.get("description"),
        price: formData.get("price"),
        stock: formData.get("stock"),
        category_id: formData.get("category_id"),
      },
    });

    // フォームデータの前処理
    const rawFormData = {
      name: formData.get("name"),
      description: formData.get("description"),
      price: formData.get("price"),
      stock: formData.get("stock") || 0,
      category_id: formData.get("category_id"),
    };

    // バリデーション
    const validationResult = productSchema.safeParse(rawFormData);
    if (!validationResult.success) {
      console.log(
        `[${traceId}] 🌟 バリデーションエラー:`,
        validationResult.error.flatten()
      );
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

    // 既存商品の取得
    const existingProduct = await db
      .prepare("SELECT id FROM products WHERE id = ?")
      .bind(productId)
      .first<{ id: number }>();

    if (!existingProduct) {
      console.log(`[${traceId}] 🌟 商品が見つかりません:`, productId);
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

    // 🌟 既存画像情報の取得ログ
    const existingImages = await db
      .prepare("SELECT id, is_main FROM images WHERE product_id = ?")
      .bind(productId)
      .all<{ id: number; is_main: number }>();
    console.log(`[${traceId}] 🌟 既存画像情報:`, existingImages.results);

    // メイン画像処理
    if (mainImageRaw instanceof File) {
      console.log(`[${traceId}] 🌟 新しいメイン画像を処理中...`);

      if (!mainImageRaw.size) {
        console.log(`[${traceId}] 🌟 空のメイン画像ファイル`);
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
      console.log(`[${traceId}] 🌟 メイン画像アップロード完了:`, mainImageUrl);

      // 古い画像を削除
      if (oldMainImage?.image_url) {
        console.log(
          `[${traceId}] 🌟 古いメイン画像を削除:`,
          oldMainImage.image_url
        );
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
      console.log(`[${traceId}] 🌟 既存のメイン画像を保持:`, mainImageRaw);
      mainImageUrl = mainImageRaw;
    }

    // 追加画像処理
    const additionalImages = formData.getAll("additionalImages") as (
      | File
      | string
    )[];
    const validAdditionalImages = additionalImages.filter(
      (img): img is File => img instanceof File
    );
    console.log(`[${traceId}] 🌟 追加画像処理開始:`, {
      received: additionalImages.length,
      valid: validAdditionalImages.length,
    });

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

      console.log(
        `[${traceId}] 🌟 追加画像アップロード完了:`,
        additionalImageUrls
      );

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

    // 不要な画像の削除処理
    const keepImageIds = formData
      .getAll("keepImageIds")
      .map((id) => {
        const num = Number(id);
        return isNaN(num) ? null : num; // 不正な値をnullに変換
      })
      .filter((id): id is number => id !== null); // nullを除外
    console.log(`[${traceId}] 🌟 画像削除処理開始:`, {
      keepImageIds,
      keepCount: keepImageIds.length,
      productId,
    });

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

      // 🌟 実際に実行されるSQLをログ出力
      console.log(`[${traceId}] 🌟 削除用SQL:`, deleteQuery.toString());

      const toDelete = await deleteQuery.all<{
        id: number;
        image_url: string;
      }>();
      console.log(`[${traceId}] 🌟 削除対象画像:`, {
        count: toDelete.results.length,
        ids: toDelete.results.map((img) => img.id),
      });

      if (toDelete.results.length > 0) {
        // 🌟 削除前確認ログ
        console.log(`[${traceId}] 🌟 画像削除開始:`, {
          r2Files: toDelete.results.map((img) => img.image_url),
          dbIds: toDelete.results.map((img) => img.id),
        });

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

        console.log(`[${traceId}] 🌟 画像削除完了`);
      }
    } else {
      console.log(`[${traceId}] 🌟 削除対象画像なし（keepImageIds空）`);
    }

    // 商品基本情報更新 =======================================
    console.log(`[${traceId}] 🌟 商品基本情報更新開始`);
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

    // 更新後の商品情報取得
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

    // 🌟 更新後の画像状態ログ
    console.log(`[${traceId}] 🌟 更新後画像状態:`, images.results);

    // レスポンス構築
    const mainImage = images.results.find((img) => img.is_main === 1);
    if (!mainImage) {
      console.error(`[${traceId}] 🌟 メイン画像が存在しません`);
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
    console.log(`[${traceId}] 🌟 商品更新成功:`, {
      productId,
      mainImageUpdated: mainImageRaw instanceof File,
      additionalImagesUploaded: additionalImageUrls.length,
      imagesDeleted: keepImageIds.length > 0 ? "一部削除" : "なし",
    });

    return c.json(response);
  } catch (error) {
    console.error(`[${traceId}] 🌟 エラー発生:`, error);
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
