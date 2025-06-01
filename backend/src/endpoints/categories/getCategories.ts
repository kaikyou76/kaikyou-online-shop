// backend/src/endpoints/categories/getCategories.ts
import { Context } from "hono";
import {
  Bindings,
  ErrorResponse,
  SuccessResponse,
  JwtPayload,
} from "../../types/types";

export const getCategoriesHandler = async (
  c: Context<{
    Bindings: Bindings;
    Variables: { jwtPayload?: JwtPayload };
  }>
): Promise<Response> => {
  const db = c.env.DB;
  const requestId = crypto.randomUUID();

  try {
    console.log(`[${requestId}] Starting category retrieval process`);

    // 認証チェック
    const payload = c.get("jwtPayload");
    console.log(`[${requestId}] Auth check - Role: ${payload?.role || "none"}`);

    if (!payload) {
      console.warn(`[${requestId}] Unauthorized access attempt`);
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "認証が必要です",
          },
        } satisfies ErrorResponse,
        401
      );
    }

    // 全カテゴリを取得
    console.log(`[${requestId}] Fetching all categories from database`);
    const categoriesResult = await db
      .prepare("SELECT id, name, parent_id FROM categories")
      .all<{ id: number; name: string; parent_id: number | null }>();

    const allCategories = categoriesResult.results || [];
    console.log(`[${requestId}] Found ${allCategories.length} categories`);

    // 階層構造を構築
    console.log(`[${requestId}] Building category hierarchy`);
    const categoryMap = new Map();
    const rootCategories: any[] = [];

    // すべてのカテゴリをマップに登録
    allCategories.forEach((category) => {
      categoryMap.set(category.id, {
        ...category,
        children: [],
      });
    });

    // 親子関係を構築
    allCategories.forEach((category) => {
      const node = categoryMap.get(category.id);
      if (category.parent_id === null) {
        rootCategories.push(node);
      } else {
        const parent = categoryMap.get(category.parent_id);
        if (parent) {
          parent.children.push(node);
        } else {
          console.warn(
            `[${requestId}] Orphaned category found: ID ${category.id}`
          );
        }
      }
    });

    // 成功レスポンス
    console.log(
      `[${requestId}] Returning ${rootCategories.length} root categories`
    );
    return c.json(
      {
        data: rootCategories,
      } satisfies SuccessResponse,
      200
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${requestId}] Error in category retrieval:`, {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    return c.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "カテゴリ一覧の取得に失敗しました",
        },
      } satisfies ErrorResponse,
      500
    );
  }
};
