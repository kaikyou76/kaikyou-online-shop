// backend/src/types.ts
export interface Bindings {
	DB: D1Database;
  }
  
  // 商品基本型
  export interface Product {
	id: number;
	name: string;
	price: number;
	image_url?: string;
  }
  
  // カートアイテム型（DB構造 + 計算フィールド）
  export interface CartItem extends Product {
	quantity: number;
	subtotal: number; // 追加計算フィールド
  }
  
  // JWTペイロード型
  export interface JwtPayload {
	user_id: number;
	email: string;
	exp?: number;
  }
  
  // エラーレスポンス型
  export interface ErrorResponse {
	error: {
	  message: string;
	  details?: Record<string, unknown>;
	};
  }
  
  // APIレスポンス型（成功/失敗共用）
  export type ApiResponse<T> = 
	| { data: T; success: true }
	| { error: string; details?: unknown; success: false };
  