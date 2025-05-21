// backend/src/endpoints/productCreate.ts
import { Context } from "hono";
import {
  Bindings,
  ErrorResponse,
  ProductCreateResponse,
  JwtPayload,
} from "../types/types";
import { productSchema } from "../schemas/product";
import { uploadToR2 } from "../lib/storage";

export const productPostHandler = async (
  c: Context<{ Bindings: Bindings; Variables: { jwtPayload?: JwtPayload } }>
): Promise<Response> => {
  const db = c.env.DB;

  try {
    console.log("Received form data:", await c.req.formData());

    // 認証チェック
    const payload = c.get("jwtPayload");
    if (!payload || payload.role !== "admin") {
      return c.json(
        {
          error: {
            code: !payload ? "UNAUTHORIZED" : "FORBIDDEN",
            message: !payload
              ? "認証が必要です"
              : "商品登録には管理者権限が必要です",
          },
        } satisfies ErrorResponse,
        !payload ? 401 : 403
      );
    }

    const formData = await c.req.formData();

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

    // 画像処理
    const mainImageRaw = formData.get("mainImage") as string | File;
    const mainImageFile = mainImageRaw instanceof File ? mainImageRaw : null;
    const additionalImageFiles = (
      formData.getAll("additionalImages") as (string | File)[]
    ).filter((item): item is File => item instanceof File);

    if (!mainImageFile?.size) {
      return c.json(
        {
          error: {
            code: "MISSING_MAIN_IMAGE",
            message: "メイン画像が必須です",
          },
        } satisfies ErrorResponse,
        400
      );
    }

    // R2アップロード
    const [mainImage, additionalImages] = await Promise.all([
      uploadToR2(c.env.R2_BUCKET, mainImageFile, c.env.R2_PUBLIC_DOMAIN, {
        folder: "products/main",
      }),
      Promise.all(
        additionalImageFiles
          .filter((file) => file.size > 0)
          .map((file) =>
            uploadToR2(c.env.R2_BUCKET, file, c.env.R2_PUBLIC_DOMAIN, {
              folder: "products/additional",
            })
          )
      ),
    ]);

    // 商品情報挿入
    const productInsert = await db
      .prepare(
        `INSERT INTO products (
          name, description, price, stock, category_id, 
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?) RETURNING id;`
      )
      .bind(
        validationResult.data.name,
        validationResult.data.description,
        validationResult.data.price,
        validationResult.data.stock,
        validationResult.data.category_id,
        new Date().toISOString()
      )
      .first<{ id: number }>();

    // 商品IDの存在チェック
    if (!productInsert?.id) {
      throw new Error("商品IDの取得に失敗しました");
    }

    // メイン画像挿入
    const mainImageInsert = await db
      .prepare(
        `INSERT INTO images (
          product_id, image_url, is_main, created_at
        ) VALUES (?, ?, ?, ?)`
      )
      .bind(productInsert.id, mainImage.url, 1, new Date().toISOString())
      .run();

    // メイン画像挿入結果チェック
    if (!mainImageInsert.success) {
      throw new Error("メイン画像の登録に失敗しました");
    }

    // 追加画像挿入
    if (additionalImages.length > 0) {
      const additionalInserts = await db.batch(
        additionalImages.map((img) =>
          db
            .prepare(
              `INSERT INTO images (
                product_id, image_url, is_main, created_at
              ) VALUES (?, ?, ?, ?)`
            )
            .bind(productInsert.id, img.url, 0, new Date().toISOString())
        )
      );
      // 追加画像挿入結果チェック
      if (additionalInserts.some((result) => !result.success)) {
        throw new Error("追加画像の登録に失敗しました");
      }
    }

    // デバッグログ
    console.log("Main Image Upload Result:", {
      url: mainImage.url,
      size: mainImageFile?.size,
      type: mainImageFile?.type,
      folder: "products/main",
    });
    console.log(
      "Additional Images Upload Results:",
      additionalImages.map((img, index) => ({
        url: img.url,
        size: additionalImageFiles[index]?.size,
        type: additionalImageFiles[index]?.type,
        folder: "products/additional",
      }))
    );

    // レスポンス
    return c.json(
      {
        success: true,
        data: {
          id: productInsert.id,
          name: validationResult.data.name,
          price: validationResult.data.price,
          stock: validationResult.data.stock,
          images: {
            main: {
              url: mainImage.url,
              is_main: true,
              uploaded_at: new Date().toISOString(),
            },
            additional: additionalImages.map((img) => ({
              url: img.url,
              is_main: false,
              uploaded_at: new Date().toISOString(),
            })),
          },
          createdAt: new Date().toISOString(),
        },
      } satisfies ProductCreateResponse,
      201
    );
  } catch (error) {
    console.error("Error:", error);
    return c.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            error instanceof Error ? error.message : "処理に失敗しました",
        },
      } satisfies ErrorResponse,
      500
    );
  }
};
