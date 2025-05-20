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
  try {
    console.log("Received form data:", await c.req.formData()); // デバッグ用ログ
    // 認証チェック (追加部分)
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

    // フォームデータの前処理 (元のコードを維持)
    const rawFormData = {
      name: formData.get("name"),
      description: formData.get("description"),
      price: formData.get("price"),
      stock: formData.get("stock") || 0,
      category_id: formData.get("category_id"),
    };

    // バリデーション (元のコードを維持)
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

    // R2アップロード (元のコードを維持)
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

    // DB操作 (修正部分)
    const productInsert = await c.env.DB.prepare(
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

    // メイン画像登録 (追加部分)
    await c.env.DB.prepare(
      `INSERT INTO images (
      product_id, image_url, is_main, created_at
    ) VALUES (?, ?, ?, ?)`
    ).bind(productInsert.id, mainImage.url, true, new Date().toISOString());

    // 追加画像登録 (元のコードを維持)
    if (additionalImages.length > 0) {
      await c.env.DB.batch(
        additionalImages.map((img) =>
          c.env.DB.prepare(
            `INSERT INTO images (
            product_id, image_url, is_main, created_at
          ) VALUES (?, ?, ?, ?)`
          ).bind(productInsert.id, img.url, false, new Date().toISOString())
        )
      );
    }

    // レスポンス (元のコードを維持)
    return c.json(
      {
        success: true,
        data: {
          id: productInsert.id,
          name: validationResult.data.name,
          price: validationResult.data.price,
          stock: validationResult.data.stock,
          images: {
            main: mainImage.url,
            additional: additionalImages.map((img) => img.url),
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
          message: "処理に失敗しました",
        },
      } satisfies ErrorResponse,
      500
    );
  }
};
