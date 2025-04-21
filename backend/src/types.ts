// =====================
// Cloudflare 環境変数 & Bindings
// =====================
export interface Env {
	DB: D1Database;
	JWT_SECRET: string;
	JWT_ISSUER: string;
	JWT_AUDIENCE: string;
	ENVIRONMENT: 'development' | 'production' | 'staging';
  }
  
  // 後方互換性のために Bindings も保持
  export interface Bindings extends Env {}
  
  // =====================
  // 認証関連タイプ
  // =====================
  export interface JwtPayload {
	user_id: number;
	email: string;
	exp: number;
	iat?: number;
	iss?: string;
	aud?: string | string[];
  }
  
  // =====================
  // データベースエンティティ
  // =====================
  export interface CartItem {
	id: number;
	product_id: number;
	user_id: number | null;
	session_id: string | null;
	quantity: number;
	created_at: string;
	
	// APIレスポンス用計算フィールド
	subtotal?: number;
	name?: string;
	price?: number;
	image_url?: string;
  }
  
  // =====================
  // API レスポンスタイプ
  // =====================
  export interface ErrorResponse {
	error: {
	  message: string;
	  details?: Record<string, unknown> | string;
	  solution?: string;
	};
  }
  
  export interface SuccessResponse<T = unknown> {
	data: T;
	meta?: {
	  page?: number;
	  per_page?: number;
	  total?: number;
	};
  }
  
  // =====================
  // Hono 型拡張
  // =====================
  declare module 'hono' {
	interface ContextVariableMap {
	  jwtPayload?: JwtPayload;  // 認証オプショナルに統一
	}
  }
  