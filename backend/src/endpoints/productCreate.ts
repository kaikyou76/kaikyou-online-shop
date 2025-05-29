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
  const requestId = crypto.randomUUID(); // リクエスト追跡用ID

  try {
    console.log(`[${requestId}] Starting product creation process`);

    // 認証チェック
    const payload = c.get("jwtPayload");
    console.log(`[${requestId}] Auth check - Role: ${payload?.role || "none"}`);

    if (!payload || payload.role !== "admin") {
      const errorType = !payload ? "UNAUTHORIZED" : "FORBIDDEN";
      console.warn(`[${requestId}] Auth failed - ${errorType}`);
      return c.json(
        {
          error: {
            code: errorType,
            message: !payload
              ? "認証が必要です"
              : "商品登録には管理者権限が必要です",
          },
        } satisfies ErrorResponse,
        !payload ? 401 : 403
      );
    }

    // フォームデータ処理
    const formData = await c.req.formData();
    console.log(`[${requestId}] Received form data fields:`, [
      ...formData.keys(),
    ]);

    const rawFormData = {
      name: formData.get("name"),
      description: formData.get("description"),
      price: formData.get("price"),
      stock: formData.get("stock") || 0,
      category_id: formData.get("category_id"),
    };

    // バリデーション
    console.log(`[${requestId}] Validating input data`);
    const validationResult = productSchema.safeParse(rawFormData);
    if (!validationResult.success) {
      console.warn(
        `[${requestId}] Validation failed:`,
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

    // 画像処理
    console.log(`[${requestId}] Processing images`);
    const mainImageRaw = formData.get("mainImage") as string | File;
    const mainImageFile = mainImageRaw instanceof File ? mainImageRaw : null;
    const additionalImageFiles = (
      formData.getAll("additionalImages") as (string | File)[]
    ).filter((item): item is File => item instanceof File);

    if (!mainImageFile?.size) {
      console.warn(`[${requestId}] Missing main image`);
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
    console.log(`[${requestId}] Uploading images to R2`);
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

    console.log(`[${requestId}] Image upload results`, {
      mainImage: {
        url: mainImage.url,
        size: mainImageFile.size,
        type: mainImageFile.type,
      },
      additionalImages: additionalImages.map((img, i) => ({
        url: img.url,
        size: additionalImageFiles[i].size,
        type: additionalImageFiles[i].type,
      })),
    });

    // 商品情報挿入
    console.log(`[${requestId}] Inserting product into database`);
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

    if (!productInsert?.id) {
      throw new Error("商品IDの取得に失敗しました");
    }
    console.log(`[${requestId}] Product created with ID: ${productInsert.id}`);

    // 画像データベース登録
    console.log(`[${requestId}] Registering images in database`);

    // メイン画像挿入
    const mainImageInsert = await db
      .prepare(
        `INSERT INTO images (
          product_id, image_url, is_main, created_at
        ) VALUES (?, ?, ?, ?) RETURNING id;`
      )
      .bind(productInsert.id, mainImage.url, 1, new Date().toISOString())
      .first<{ id: number }>();

    if (!mainImageInsert.id) {
      throw new Error("メイン画像の登録に失敗しました");
    }
    console.log(
      `[${requestId}] Main image registered with ID: ${mainImageInsert.id}`
    );

    // 追加画像挿入
    let additionalImageResults: { id: number; url: string }[] = [];
    if (additionalImages.length > 0) {
      console.log(
        `[${requestId}] Registering ${additionalImages.length} additional images`
      );
      additionalImageResults = await Promise.all(
        additionalImages.map(async (img) => {
          const result = await db
            .prepare(
              `INSERT INTO images (
                product_id, image_url, is_main, created_at
              ) VALUES (?, ?, ?, ?) RETURNING id;`
            )
            .bind(productInsert.id, img.url, 0, new Date().toISOString())
            .first<{ id: number }>();

          if (!result?.id) {
            throw new Error(`追加画像の登録に失敗しました: ${img.url}`);
          }
          return {
            id: result.id,
            url: img.url,
          };
        })
      );
      console.log(
        `[${requestId}] Additional images registered with IDs:`,
        additionalImageResults.map((img) => img.id)
      );
    }

    // 成功レスポンス
    console.log(`[${requestId}] Product creation successful`);
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
              id: mainImageInsert.id,
              url: mainImage.url,
              is_main: true,
              uploaded_at: new Date().toISOString(),
            },
            additional: additionalImageResults.map((img) => ({
              id: img.id,
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
    console.error(`[${requestId}] Error in product creation:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
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
