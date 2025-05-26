// backend/src/endpoints/productEditById.ts
import { Context } from "hono";
import { Bindings, ErrorResponse, JwtPayload } from "../types/types";
import { productSchema } from "../schemas/product";
import { uploadToR2, deleteFromR2 } from "../lib/storage";

// FormDataEntryValueの型定義を追加
type FormDataEntryValue = string | File;

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

    console.log(`[${traceId}] 🌟 受信FormData:`, {
      keepImageIds: formData.getAll("keepImageIds"),
      deleteImageIds: formData.getAll("deleteImageIds"),
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

    const rawFormData = {
      name: formData.get("name"),
      description: formData.get("description"),
      price: formData.get("price"),
      stock: formData.get("stock") || 0,
      category_id: formData.get("category_id"),
    };

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

    // 既存画像を取得
    const existingImages = await db
      .prepare("SELECT id, image_url, is_main FROM images WHERE product_id = ?")
      .bind(productId)
      .all<{ id: number; image_url: string; is_main: number }>();
    console.log(`[${traceId}] 🌟 既存画像情報:`, existingImages.results);

    // メイン画像処理
    const mainImageRaw = formData.get("mainImage") as File | string | null;
    let mainImageUrl: string | undefined;

    if (mainImageRaw instanceof File) {
      console.log(`[${traceId}] 🌟 新しいメイン画像を処理中...`);

      if (!mainImageRaw.size) {
        console.log(`[${traceId}] 🌟 空のメイン画像ファイル`);
        return c.json({ error: "空の画像ファイル" }, 400);
      }

      const oldMainImage = await db
        .prepare(
          "SELECT id, image_url FROM images WHERE product_id = ? AND is_main = 1"
        )
        .bind(productId)
        .first<{ id: number; image_url: string }>();

      const uploadResult = await uploadToR2(
        c.env.R2_BUCKET as R2Bucket,
        mainImageRaw,
        c.env.R2_PUBLIC_DOMAIN as string,
        { folder: "products/main" }
      );
      mainImageUrl = uploadResult.url;
      console.log(`[${traceId}] 🌟 メイン画像アップロード完了:`, mainImageUrl);

      if (oldMainImage?.image_url) {
        console.log(
          `[${traceId}] 🌟 古いメイン画像を削除:`,
          oldMainImage.image_url
        );
        await deleteFromR2(c.env.R2_BUCKET as R2Bucket, oldMainImage.image_url);
      }

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
            uploadToR2(
              c.env.R2_BUCKET as R2Bucket,
              file,
              c.env.R2_PUBLIC_DOMAIN as string,
              { folder: "products/additional" }
            )
          )
        )
      ).map((result) => result.url);

      console.log(
        `[${traceId}] 🌟 追加画像アップロード完了:`,
        additionalImageUrls
      );

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

    // 削除処理ロジック
    const deleteImageIds = formData
      .getAll("deleteImageIds")
      .map((id) => {
        const num = Number(id);
        return isNaN(num) ? null : num;
      })
      .filter((id): id is number => id !== null);

    const keepImageIds = formData
      .getAll("keepImageIds")
      .map((id) => {
        const num = Number(id);
        return isNaN(num) ? null : num;
      })
      .filter((id): id is number => id !== null);

    console.log(`[${traceId}] 🌟 削除処理パラメータ:`, {
      deleteImageIds,
      keepImageIds,
      existingImageIds: existingImages.results?.map((img) => img.id) ?? [],
    });

    // 明示的な削除IDが指定されている場合
    if (deleteImageIds.length > 0) {
      console.log(`[${traceId}] 🌟 明示的削除モード開始`);

      const validDeleteIds =
        existingImages.results
          ?.filter((img) => deleteImageIds.includes(img.id))
          .map((img) => img.id) ?? [];

      if (validDeleteIds.length !== deleteImageIds.length) {
        const invalidIds = deleteImageIds.filter(
          (id) => !validDeleteIds.includes(id)
        );
        console.error(`[${traceId}] ❌ 無効な削除ID検出:`, invalidIds);
        return c.json(
          {
            error: {
              code: "INVALID_IMAGE_IDS",
              message: "指定された画像IDの一部が無効です",
              details: { invalidIds },
            },
          } satisfies ErrorResponse<{ invalidIds: number[] }>,
          400
        );
      }

      // 削除対象画像取得
      const toDelete = await db
        .prepare(
          `SELECT id, image_url FROM images 
           WHERE product_id = ? 
           AND id IN (${deleteImageIds.map(() => "?").join(",")})`
        )
        .bind(productId, ...deleteImageIds)
        .all<{ id: number; image_url: string }>();

      console.log(`[${traceId}] 🌟 削除対象画像:`, {
        count: toDelete.results?.length ?? 0,
        ids: toDelete.results?.map((img) => img.id) ?? [],
      });

      if (toDelete.results && toDelete.results.length > 0) {
        // DBから削除
        await db
          .prepare(
            `DELETE FROM images WHERE id IN (${toDelete.results
              .map((img) => img.id)
              .join(",")})`
          )
          .run();

        // R2から削除
        await Promise.all(
          toDelete.results.map((img) =>
            deleteFromR2(c.env.R2_BUCKET as R2Bucket, img.image_url)
          )
        );
        console.log(`[${traceId}] ✅ 画像削除完了`);
      }
    }
    // keepImageIds を使った従来の削除ロジック
    else if (keepImageIds.length > 0) {
      console.log(`[${traceId}] 🌟 保持IDベース削除モード開始`);

      const validKeepIds = keepImageIds.filter((id) =>
        existingImages.results?.some((img) => img.id === id)
      );

      console.log(`[${traceId}] 🌟 有効な保持ID:`, validKeepIds);

      const deleteQuery = db
        .prepare(
          `SELECT id, image_url FROM images 
           WHERE product_id = ? 
           AND is_main = 0 
           ${
             validKeepIds.length > 0
               ? `AND id NOT IN (${validKeepIds.map(() => "?").join(",")})`
               : ""
           }
           AND image_url NOT IN (${additionalImageUrls
             .map(() => "?")
             .join(",")})`
        )
        .bind(
          productId,
          ...(validKeepIds.length > 0 ? validKeepIds : []),
          ...additionalImageUrls
        );

      const toDelete = await deleteQuery.all<{
        id: number;
        image_url: string;
      }>();

      console.log(`[${traceId}] 🌟 削除対象特定結果:`, {
        targetCount: toDelete.results?.length ?? 0,
        sampleIds: toDelete.results?.slice(0, 3).map((t) => t.id) ?? [],
      });

      if (toDelete.results && toDelete.results.length > 0) {
        await Promise.all([
          ...toDelete.results.map((img) =>
            deleteFromR2(c.env.R2_BUCKET as R2Bucket, img.image_url)
          ),
          db
            .prepare(
              `DELETE FROM images WHERE id IN (${toDelete.results
                .map((img) => img.id)
                .join(",")})`
            )
            .run(),
        ]);
      }
    }

    // 商品基本情報更新
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

    console.log(`[${traceId}] 🌟 更新後画像状態:`, images.results);

    const mainImage = images.results?.find((img) => img.is_main === 1);
    if (!mainImage) {
      console.error(`[${traceId}] 🌟 メイン画像が存在しません`);
      throw new Error("メイン画像が存在しません");
    }

    const response: ProductResponse = {
      ...updatedProduct!,
      images: {
        main: {
          id: mainImage.id,
          url: mainImage.url,
          is_main: true,
        },
        additional:
          images.results
            ?.filter((img) => img.is_main === 0)
            .map((img) => ({
              id: img.id,
              url: img.url,
              is_main: false,
            })) ?? [],
      },
    };

    console.log(`[${traceId}] 🌟 商品更新成功:`, {
      productId,
      mainImageUpdated: mainImageRaw instanceof File,
      additionalImagesUploaded: additionalImageUrls.length,
      imagesDeleted:
        deleteImageIds.length > 0 || keepImageIds.length > 0
          ? "一部削除"
          : "なし",
    });

    // 管理ログの記録
    try {
      await db
        .prepare(
          `INSERT INTO admin_logs 
       (admin_id, action, target_type, target_id, description) 
       VALUES (?, ?, ?, ?, ?)`
        )
        .bind(
          payload.user_id,
          "update_product",
          "product",
          productId,
          JSON.stringify({
            status: "processing",
            keepImageIds: keepImageIds,
            startTime: new Date().toISOString(),
            traceId,
          })
        )
        .run();
      console.log(`[${traceId}] 📝 管理ログ記録完了`);
    } catch (logError) {
      console.error(`[${traceId}] ❌ 管理ログ記録失敗:`, logError);
    }

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
