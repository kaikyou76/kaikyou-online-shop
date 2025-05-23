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
import { getUsersHandler } from "../endpoints/users/getUsers";
import { getUserByIdHandler } from "../endpoints/users/getUserById";
import { updateUserHandler } from "../endpoints/users/updateUser";
import { deleteUserHandler } from "../endpoints/users/deleteUser";
import { getSessionsHandler } from "../endpoints/auth/getSessionsHandler";
import { validateHandler } from "../endpoints/auth/validate";
import { productEditByIdHandler } from "../endpoints/productEditById";
//import { changePasswordHandler } from "../endpoints/auth/changePassword";

const app = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

// ログ出力ミドルウェア（構造化ログを維持）
app.use("*", async (c, next) => {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      method: c.req.method,
      path: c.req.path,
      normalizedPath: c.req.path.replace(/\/+/g, "/"), // パス正規化追加
      ip: c.req.header("CF-Connecting-IP"),
      phase: "request-start",
      environment: c.env.ENVIRONMENT, // c.envを使用
    })
  );
  await next();
});

// セキュリティヘッダー追加ミドルウェア
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
});

// ヘルスチェック
app.get("/health", (c) => c.json({ status: "ok" }));

// APIルート (ベースパス /api)
const apiRoutes = app.basePath("/api");

// CORS設定（オリジン制限を環境変数から取得
apiRoutes.use("*", async (c, next) => {
  const corsMiddleware = cors({
    origin:
      c.env.ENVIRONMENT === "production"
        ? [
            "https://kaikyou-online-shop.onrender.com",
            "https://kaikyou-online-shop.vercel.app",
            "http://localhost:3000",
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
protectedRoutes.put("/products/:id", productEditByIdHandler);
protectedRoutes.get("/cart", getCartHandler);
protectedRoutes.get("/users", getUsersHandler);
protectedRoutes.get("/users/:id", getUserByIdHandler);
protectedRoutes.put("/users/:id", updateUserHandler);
protectedRoutes.delete("/users/:id", deleteUserHandler);
protectedRoutes.get("/sessions", getSessionsHandler);
protectedRoutes.get("/validate", validateHandler);
//protectedRoutes.put("/users/change-password", changePasswordHandler);

// エラーハンドリング（ログ強化）
app.notFound((c) => {
  console.warn(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      status: 404,
      path: c.req.path,
      method: c.req.method,
      message: "Route not found",
    })
  );

  return c.json(
    {
      error: "Not Found",
      path: c.req.path,
      method: c.req.method,
    },
    404
  );
});

app.onError((err, c) => {
  const errorId = Math.random().toString(36).substring(2, 8);
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      errorId,
      path: c.req.path,
      method: c.req.method,
      error: {
        name: err.name,
        message: err.message,
        stack: c.env.ENVIRONMENT === "development" ? err.stack : undefined,
      },
      phase: "error-handling",
    })
  );

  const headers = c.req.raw.headers;
  const requestId = headers.get("X-Request-ID") || errorId;
  return c.json(
    {
      error: "Internal Server Error",
      requestId: requestId,
      ...(c.env.ENVIRONMENT !== "production" && {
        details: err.message,
      }),
    },
    500
  );
});

export default app;
