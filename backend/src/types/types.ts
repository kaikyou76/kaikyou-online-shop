// backend/src/types/types.ts
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { z } from "zod";
import { productSchema } from "@/schemas/product";

// エラーコードを定義
export const INVALID_SESSION = "INVALID_SESSION";

/**
 * Cloudflare Worker にバインドされる環境変数
 */
export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  ENVIRONMENT: "development" | "production" | "staging";
  R2_BUCKET: R2Bucket;
  R2_PUBLIC_DOMAIN: string;
}

/**
 * 後方互換のために保持している型エイリアス
 * 現在は Env と同一内容
 */
export interface Bindings extends Env {}

/**
 * JWT トークンから復号されるペイロード情報
 */
export interface JwtPayload {
  user_id: number;
  email: string;
  exp: number;
  iat?: number;
  iss?: string;
  aud?: string | string[];
  role?: string;
}

/**
 * Hono コンテキストで使用する一時変数（リクエストごとのスコープ）
 * jwtMiddleware などでセットされる
 */
export interface Variables {
  jwtPayload?: JwtPayload; // 検証済みJWTペイロード（未認証なら undefined）
}

/**
 * カート内の商品1件のデータ型
 */
export interface CartItem {
  id: number;
  product_id: number;
  user_id: number | null;
  session_id: string | null;
  quantity: number;
  created_at: string;
  subtotal?: number;
  name?: string;
  price?: number;
  image_url?: string;
}

// ================== エラーレスポンス関連 ==================

/**
 * エラーの基本構造
 */
interface ErrorBase {
  code: string;
  message: string;
  solution?: string;
  meta?: {
    errorMessage?: string;
    required?: string[];
    received?: Record<string, unknown>;
  };
  issues?: Array<{
    path: (string | number)[];
    message: string;
  }>;
}

/**
 * 汎用エラーレスポンス
 */
export interface ErrorResponse<T = unknown> {
  error: ErrorBase & {
    details?: T;
  };
}

/**
 * Zodバリデーションエラーの型ユーティリティ
 */
export type ZodFlattenedError<T extends z.ZodTypeAny> = z.typeToFlattenedError<
  z.infer<T>
>;

/**
 * 商品関連のエラーレスポンス
 */
export interface ProductErrorResponse {
  error: ErrorBase & {
    details: ZodFlattenedError<typeof productSchema>;
  };
}

// ================== 成功レスポンス関連 ==================

/**
 * 成功レスポンスの基本型
 */
export interface SuccessResponse<T = unknown> {
  data: T;
  meta?: {
    page?: number;
    per_page?: number;
    total?: number;
    total_pages?: number;
  };
}

export interface LoginResponseData {
  token: string;
  refreshToken?: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
}

interface ImageResponse {
  url: string;
  is_main: boolean;
  uploaded_at: string;
}

export interface ProductCreateResponse {
  success: boolean;
  data: {
    id: number;
    name: string;
    price: number;
    stock: number;
    images: {
      main: ImageResponse;
      additional: ImageResponse[];
    };
    createdAt: string;
  };
}

// ================== Hono拡張 ==================
/**
 * Hono の Context に拡張変数を型として登録
 * ctx.get('jwtPayload') などの補完が効くようになる
 */
declare module "hono" {
  interface ContextVariableMap {
    jwtPayload?: JwtPayload; // 認証オプショナルに統一
  }
}

// ================== ストレージ関連 ==================
// ストレージ関連の型（必要に応じて拡張）
export interface StorageConfig {
  folder?: string;
  maxFileSize?: number;
}
