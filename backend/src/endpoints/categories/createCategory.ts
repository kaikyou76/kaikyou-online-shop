// backend/src/endpoints/categories/createCategory.ts
import { Context } from "hono";
import { Bindings, ErrorResponse, JwtPayload } from "../../types/types";

export const categoriesPostHandler = async (
  c: Context<{ Bindings: Bindings; Variables: { jwtPayload?: JwtPayload } }>
): Promise<Response> => {
  const db = c.env.DB;
  const requestId = crypto.randomUUID();

  try {
    console.log(`[${requestId}] Starting category creation process`);

    // 認証チェック (管理者権限必須)
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
              : "カテゴリ登録には管理者権限が必要です",
          },
        } satisfies ErrorResponse,
        !payload ? 401 : 403
      );
    }

    // JSONボディ取得
    console.log(`[${requestId}] Parsing request body`);
    const body = await c.req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      console.warn(`[${requestId}] Invalid request body`);
      return c.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "リクエストボディが不正です",
          },
        } satisfies ErrorResponse,
        400
      );
    }

    const { name, parent_id } = body as {
      name?: unknown;
      parent_id?: unknown;
    };

    // 簡易バリデーション
    console.log(`[${requestId}] Validating input data`);
    const errors: Record<string, string> = {};

    if (typeof name !== "string" || !name.trim()) {
      errors.name = "カテゴリ名は必須です";
    } else if (name.length > 100) {
      errors.name = "カテゴリ名は100文字以内で入力してください";
    }

    if (parent_id !== undefined && parent_id !== null) {
      if (
        typeof parent_id !== "number" ||
        !Number.isInteger(parent_id) ||
        parent_id <= 0
      ) {
        errors.parent_id = "親カテゴリIDは正の整数で指定してください";
      }
    }

    if (Object.keys(errors).length > 0) {
      console.warn(`[${requestId}] Validation failed:`, errors);
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "入力内容に誤りがあります",
            details: errors,
          },
        } satisfies ErrorResponse,
        400
      );
    }

    // 親カテゴリの存在チェック
    if (parent_id) {
      console.log(
        `[${requestId}] Checking parent category existence: ${parent_id}`
      );
      const parentCheck = await db
        .prepare("SELECT id FROM categories WHERE id = ?")
        .bind(parent_id)
        .first<{ id: number }>();

      if (!parentCheck) {
        console.warn(`[${requestId}] Parent category not found: ${parent_id}`);
        return c.json(
          {
            error: {
              code: "PARENT_NOT_FOUND",
              message: "指定された親カテゴリが存在しません",
            },
          } satisfies ErrorResponse,
          400
        );
      }
    }

    // カテゴリ重複チェック
    console.log(`[${requestId}] Checking category duplication`);
    const duplicateCheck = await db
      .prepare("SELECT id FROM categories WHERE name = ? AND parent_id IS ?")
      .bind(name, parent_id || null)
      .first<{ id: number }>();

    if (duplicateCheck) {
      console.warn(`[${requestId}] Duplicate category detected: ${name}`);
      return c.json(
        {
          error: {
            code: "DUPLICATE_CATEGORY",
            message: "同名のカテゴリが既に存在します",
          },
        } satisfies ErrorResponse,
        409
      );
    }

    // カテゴリ挿入
    console.log(`[${requestId}] Inserting category into database`);
    const insertResult = await db
      .prepare(
        `INSERT INTO categories (name, parent_id)
         VALUES (?, ?) RETURNING id, name, parent_id;`
      )
      .bind(name, parent_id || null)
      .first<{ id: number; name: string; parent_id: number | null }>();

    if (!insertResult) {
      throw new Error("カテゴリIDの取得に失敗しました");
    }

    console.log(`[${requestId}] Category created with ID: ${insertResult.id}`);

    // 成功レスポンス
    return c.json(
      {
        success: true,
        data: {
          id: insertResult.id,
          name: insertResult.name,
          parent_id: insertResult.parent_id,
        },
      },
      201
    );
  } catch (error) {
    console.error(`[${requestId}] Error in category creation:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    return c.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "カテゴリ登録処理に失敗しました",
        },
      } satisfies ErrorResponse,
      500
    );
  }
};
