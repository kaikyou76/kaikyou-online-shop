// backend/src/endpoints/productDeleteById.ts
import { Context } from "hono";
import { Bindings, ErrorResponse, JwtPayload } from "../types/types";
import { deleteFromR2 } from "../lib/storage";

export const productDeleteByIdHandler = async (
  c: Context<{ Bindings: Bindings; Variables: { jwtPayload?: JwtPayload } }>
): Promise<Response> => {
  const productId = c.req.param("id");
  const db = c.env.DB;

  try {
    // 認証チェック (管理者のみ)
    const payload = c.get("jwtPayload");
    if (!payload || payload.role !== "admin") {
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

    // 1. 関連画像の取得
    const images = await db
      .prepare("SELECT image_url FROM images WHERE product_id = ?")
      .bind(productId)
      .all<{ image_url: string }>();

    // 2. R2から画像削除
    if (images.results.length > 0) {
      await Promise.all(
        images.results.map((img) =>
          deleteFromR2(c.env.R2_BUCKET, img.image_url)
        )
      );
    }

    // 3. トランザクション実行（修正箇所）
    const statements = [
      db.prepare("DELETE FROM images WHERE product_id = ?").bind(productId),
      db.prepare("DELETE FROM products WHERE id = ?").bind(productId),
    ];

    const results = await db.batch(statements);

    // 削除結果チェック
    if (results.some((result) => !result.success)) {
      throw new Error("削除処理に失敗しました");
    }

    return c.json({ success: true, deletedId: productId }, 200);
  } catch (error) {
    console.error("[PRODUCT_DELETE_ERROR]", error);
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
