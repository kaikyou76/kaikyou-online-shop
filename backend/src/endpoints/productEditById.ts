// backend/src/endpoints/productEditById.ts
import { Context } from "hono";
import { Bindings, ErrorResponse, JwtPayload } from "../types/types";
import { productSchema } from "../schemas/product";
import { uploadToR2, deleteFromR2 } from "../lib/storage";

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
    // 認証チェック（完全な実装）
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

    // 🌟🌟 重要修正部分開始 🌟🌟
    const mainImageRaw = formData.get("mainImage") as string | File | null;
    let mainImageUrl: string | undefined;

    // 既存画像を取得（image_urlを含めるように修正）
    const existingImages = await db
      .prepare("SELECT id, image_url, is_main FROM images WHERE product_id = ?")
      .bind(productId)
      .all<{ id: number; image_url: string; is_main: number }>();
    console.log(`[${traceId}] 🌟 既存画像情報:`, existingImages.results);

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
        c.env.R2_BUCKET,
        mainImageRaw,
        c.env.R2_PUBLIC_DOMAIN,
        { folder: "products/main" }
      );
      mainImageUrl = uploadResult.url;
      console.log(`[${traceId}] 🌟 メイン画像アップロード完了:`, mainImageUrl);

      if (oldMainImage?.image_url) {
        console.log(
          `[${traceId}] 🌟 古いメイン画像を削除:`,
          oldMainImage.image_url
        );
        await deleteFromR2(c.env.R2_BUCKET, oldMainImage.image_url);
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

    // 🌟🌟 重要修正部分（削除ロジック） 🌟🌟
    const keepImageIds = formData
      .getAll("keepImageIds")
      .map((id) => {
        const num = Number(id);
        return isNaN(num) ? null : num;
      })
      .filter((id): id is number => id !== null);

    console.log(`[${traceId}] 🌟 画像削除処理開始:`, {
      keepImageIds,
      keepCount: keepImageIds.length,
      productId,
    });

    if (keepImageIds.length > 0) {
      const startTime = performance.now();

      // 🌟 削除処理開始ログ
      console.log(`[${traceId}] 🌟 画像削除処理開始`, {
        keepImageCount: keepImageIds.length,
        startTime: new Date().toISOString(),
      });
      const validKeepIds = keepImageIds
        .filter((id): id is number => typeof id === "number" && id > 0)
        .filter((v, i, a) => a.indexOf(v) === i)
        .filter((id) => existingImages.results.some((img) => img.id === id)); // 既存IDのみ保持

      console.log(`[${traceId}] 🌟 有効な保持ID検証結果:`, {
        originalCount: keepImageIds.length,
        validCount: validKeepIds.length,
        invalidIds: keepImageIds.filter((id) => !validKeepIds.includes(id)),
      });

      if (validKeepIds.length === 0 && additionalImages.length > 0) {
        console.error(`[${traceId}] 🚨 危険：全追加画像削除試行のブロック`);
        return c.json(
          {
            error: {
              code: "DANGEROUS_OPERATION",
              message: "全追加画像の削除は許可されていません",
            },
          },
          400
        );
      }

      let logEntry: { id: number } | null = null;

      try {
        console.log(`[${traceId}] 🌟 削除ログ登録開始`, {
          userId: payload.user_id,
          productId: productId,
        });

        logEntry = await db
          .prepare(
            `INSERT INTO admin_logs 
             (admin_id, action, target_type, target_id, description)
             VALUES (?, ?, ?, ?, ?)
             RETURNING id`
          )
          .bind(
            payload.user_id,
            "delete_images",
            "product",
            productId,
            JSON.stringify({
              status: "processing",
              keepImageIds: validKeepIds,
              startTime: new Date().toISOString(),
              traceId,
            })
          )
          .first<{ id: number }>();

        console.log(`[${traceId}] 🌟 削除ログ登録完了`, {
          logId: logEntry?.id,
          validKeepIdsCount: validKeepIds.length,
        });

        // 🌟🌟 重要修正（削除対象クエリ）
        const deleteQuery =
          validKeepIds.length > 0
            ? db
                .prepare(
                  `SELECT id, image_url FROM images 
               WHERE product_id = ? 
               AND is_main = 0 
               AND id NOT IN (${validKeepIds.map(() => "?").join(",")})
               AND image_url NOT IN (${additionalImageUrls
                 .map(() => "?")
                 .join(",")})`
                )
                .bind(productId, ...validKeepIds, ...additionalImageUrls)
            : db
                .prepare(
                  `SELECT id, image_url FROM images 
               WHERE product_id = ? 
               AND is_main = 0
               AND image_url NOT IN (${additionalImageUrls
                 .map(() => "?")
                 .join(",")})`
                )
                .bind(productId, ...additionalImageUrls);

        console.log(
          `[${traceId}] 🌟 削除対象検索クエリ:`,
          deleteQuery.toString()
        );

        const toDelete = await deleteQuery.all<{
          id: number;
          image_url: string;
        }>();
        const deleteTargets = toDelete.results;

        console.log(`[${traceId}] 🌟 削除対象特定結果:`, {
          targetCount: deleteTargets.length,
          sampleIds: deleteTargets.slice(0, 3).map((t) => t.id),
        });

        if (deleteTargets.length > 0) {
          const MAX_RETRIES = 3;
          const chunkSize = 100;

          // データベース削除（リトライ付き）
          for (let i = 0; i < deleteTargets.length; i += chunkSize) {
            const chunk = deleteTargets.slice(i, i + chunkSize);
            let retryCount = 0;

            while (retryCount < MAX_RETRIES) {
              try {
                await db.batch(
                  chunk.map((img) =>
                    db.prepare("DELETE FROM images WHERE id = ?").bind(img.id)
                  )
                );
                break;
              } catch (error) {
                retryCount++;
                if (retryCount === MAX_RETRIES) throw error;
                await new Promise((resolve) => setTimeout(resolve, 1000));
              }
            }
          }

          // ストレージ削除（リトライ付き）
          await Promise.all(
            deleteTargets.map(async (img, index) => {
              let retries = 3;
              while (retries > 0) {
                try {
                  await deleteFromR2(c.env.R2_BUCKET, img.image_url);
                  console.log(
                    `[${traceId}] ✅ ファイル削除成功: ${img.image_url}`
                  );
                  break;
                } catch (error) {
                  retries--;
                  if (retries === 0) {
                    console.error(
                      `[${traceId}] ❌ ファイル削除失敗: ${img.image_url}`,
                      error
                    );
                    throw error;
                  }
                  await new Promise((resolve) => setTimeout(resolve, 1000));
                }
              }
            })
          );
        }

        // ログ更新
        await db
          .prepare(
            `UPDATE admin_logs SET
             description = ?,
             created_at = ?
             WHERE id = ?`
          )
          .bind(
            JSON.stringify({
              status: "success",
              deletedCount: deleteTargets.length,
              elapsedMs: performance.now() - startTime,
            }),
            new Date().toISOString(),
            logEntry.id
          )
          .run();
      } catch (error) {
        console.error(`[${traceId}] ❌ 削除処理例外発生`, {
          error: error.message,
          stack: error.stack?.split("\n")[0],
        });

        if (logEntry) {
          await db
            .prepare(
              `UPDATE admin_logs SET
               description = ?,
               created_at = ?
               WHERE id = ?`
            )
            .bind(
              JSON.stringify({
                status: "error",
                error: error.message,
                timestamp: new Date().toISOString(),
              }),
              new Date().toISOString(),
              logEntry.id
            )
            .run();
        }
        throw error;
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
