// backend/src/routes/index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Bindings, Variables } from "../types/types";
import { productPostHandler } from "../endpoints/productCreate";
import { productGetHandler } from "../endpoints/productGet";
import { getCartHandler } from "../endpoints/getCart";
import { jwtMiddleware } from "../middleware/jwt";
import { productGetByIdHandler } from "../endpoints/productGetById";
import { registerHandler } from "../endpoints/auth/register";
import { loginHandler } from "../endpoints/auth/login";
import { logoutHandler } from "../endpoints/auth/logout";
import { getUserHandler } from "../endpoints/auth/getUser";
//import { getSessionsHandler } from "../endpoints/auth/getSessionsHandler";
//import { changePasswordHandler } from "../endpoints/auth/changePassword";

const app = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

// 変更点1: ログ出力を構造化
app.use("*", async (c, next) => {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      method: c.req.method,
      path: c.req.path,
      ip: c.req.header("CF-Connecting-IP"),
    })
  );
  await next();
});

// 変更点2: セキュリティヘッダー追加ミドルウェア
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
});

// ヘルスチェック（変更なし）
app.get("/health", (c) => c.json({ status: "ok" }));

// APIルート (ベースパス /api)（変更なし）
const apiRoutes = app.basePath("/api");

// CORS設定（オリジン制限を環境変数から取得するよう変更）
apiRoutes.use("*", async (c, next) => {
  const corsMiddleware = cors({
    origin:
      c.env.ENVIRONMENT === "production"
        ? [
            "https://kaikyou-online-shop.onrender.com",
            "https://kaikyou-online-shop-a931tgj10-kaikyous-projects.vercel.app",
          ]
        : [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:8787",
            "http://127.0.0.1:8787",
          ],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length"],
    maxAge: 86400,
    credentials: true,
  });
  return corsMiddleware(c, next);
});

// 認証不要ルート（グループ化コメント追加）
// === 公開エンドポイント ===
apiRoutes.post("/register", registerHandler);
apiRoutes.post("/login", loginHandler);
apiRoutes.get("/products", productGetHandler);
apiRoutes.get("/products/:id", productGetByIdHandler);

// 認証必須ルート（型安全性向上）
const protectedRoutes = apiRoutes.use("*", jwtMiddleware);
// === 保護対象エンドポイント ===
protectedRoutes.post("/logout", logoutHandler);
protectedRoutes.get("/users/me", getUserHandler);
protectedRoutes.post("/products", productPostHandler);
protectedRoutes.get("/cart", getCartHandler);
//protectedRoutes.get("/sessions", getSessionsHandler);
//protectedRoutes.put("/users/change-password", changePasswordHandler);

// エラーハンドリング（詳細情報追加）
app.notFound((c) =>
  c.json(
    {
      error: "Not Found",
      path: c.req.path,
      method: c.req.method,
    },
    404
  )
);

app.onError((err, c) => {
  console.error("Error:", {
    message: err.message,
    stack: err.stack,
    url: c.req.url,
  });
  const headers = c.req.raw.headers; // 生のHeadersオブジェクト
  const requestId = headers.get("X-Request-ID");
  return c.json(
    {
      error: "Internal Server Error",
      requestId: requestId,
      ...(c.env.ENVIRONMENT === "development" && {
        details: err.message,
        stack: err.stack,
      }),
    },
    500
  );
});

export default app;
