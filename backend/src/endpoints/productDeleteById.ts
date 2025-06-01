// backend/src/endpoints/productDeleteById.ts
import { Context } from "hono";
import { Bindings, ErrorResponse, JwtPayload } from "../types/types";
import { deleteFromR2 } from "../lib/storage";

export const productDeleteByIdHandler = async (
  c: Context<{ Bindings: Bindings; Variables: { jwtPayload?: JwtPayload } }>
): Promise<Response> => {
  const productId = c.req.param("id");
  const db = c.env.DB;
  const requestId = crypto.randomUUID();

  try {
    // 認証チェック (管理者のみ)
    const payload = c.get("jwtPayload");
    console.log(`[${requestId}] Auth check - Role: ${payload?.role || "none"}`);

    if (!payload || payload.role !== "admin") {
      console.warn(`[${requestId}] Unauthorized/Forbidden access attempt`);
      return c.json(
        {
          error: {
            code: !payload ? "UNAUTHORIZED" : "FORBIDDEN",
            message: !payload
              ? "認証が必要です"
              : "商品削除には管理者権限が必要です",
          },
        } satisfies ErrorResponse,
        !payload ? 401 : 403
      );
    }

    // 商品存在チェック
    console.log(`[${requestId}] Checking product existence: ${productId}`);
    const productCheck = await db
      .prepare("SELECT id FROM products WHERE id = ?")
      .bind(productId)
      .first<{ id: number }>();

    if (!productCheck) {
      console.warn(`[${requestId}] Product not found: ${productId}`);
      return c.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "指定された商品は存在しません",
          },
        } satisfies ErrorResponse,
        404
      );
    }

    // 関連画像の取得（削除対象のURLを事前に取得）
    console.log(`[${requestId}] Fetching images for product: ${productId}`);
    const images = await db
      .prepare("SELECT image_url FROM images WHERE product_id = ?")
      .bind(productId)
      .all<{ image_url: string }>();

    const imageUrls = images.results?.map((img) => img.image_url) || [];
    console.log(`[${requestId}] Found ${imageUrls.length} images to delete`);

    // DB削除処理（トランザクション）
    console.log(`[${requestId}] Starting batch (transaction) for DB deletion`);
    const statements = [
      db.prepare("DELETE FROM images WHERE product_id = ?").bind(productId),
      db.prepare("DELETE FROM products WHERE id = ?").bind(productId),
    ];

    const batchResults = await db.batch(statements);
    console.log(`[${requestId}] Batch execution completed`);

    // バッチの結果をチェック
    const hasErrors = batchResults.some((result) => !result.success);
    if (hasErrors) {
      console.error(`[${requestId}] DB deletion batch failed`, batchResults);
      throw new Error("商品削除のデータベース操作に失敗しました");
    }

    // R2画像削除処理（非同期で実行、エラーが発生してもログだけ記録）
    if (imageUrls.length > 0) {
      console.log(`[${requestId}] Deleting ${imageUrls.length} images from R2`);
      try {
        await Promise.all(
          imageUrls.map((url) => deleteFromR2(c.env.R2_BUCKET, url))
        );
        console.log(`[${requestId}] All images deleted from R2`);
      } catch (r2Error) {
        // R2削除エラーは致命的ではないがログに記録
        console.error(
          `[${requestId}] Error deleting images from R2, but DB already deleted. Manual cleanup needed for:`,
          imageUrls,
          r2Error
        );
        // ここではエラーを投げない（DB削除は成功しているため）
        // クライアントには削除は成功したが、一部画像の削除に失敗したことを通知するか？
        // 現状は成功とし、ログに記録するだけ。
      }
    }

    console.log(`[${requestId}] Product deletion successful: ${productId}`);
    return c.json({ success: true, deletedId: productId }, 200);
  } catch (error) {
    console.error(`[${requestId}] [PRODUCT_DELETE_ERROR]`, error);
    return c.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            error instanceof Error ? error.message : "商品の削除に失敗しました",
        },
      } satisfies ErrorResponse,
      500
    );
  }
};
