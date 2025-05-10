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

const app = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

// グローバルミドルウェア
app.use("*", async (c, next) => {
  console.log(`[${new Date().toISOString()}] ${c.req.method} ${c.req.path}`);
  await next();
});

// ヘルスチェック
app.get("/health", (c) => c.json({ status: "ok" }));

// APIルート (ベースパス /api)
const apiRoutes = app.basePath("/api");

// CORS設定はapiRoutesに対してのみ適用
apiRoutes.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length"],
    maxAge: 86400,
  })
);

// 認証不要ルート (すべて /api 配下に移動)
apiRoutes.post("/register", registerHandler);
apiRoutes.post("/login", loginHandler);
apiRoutes.get("/products", productGetHandler);
apiRoutes.get("/products/:id", productGetByIdHandler);

// 認証必須ルート
const protectedRoutes = apiRoutes.use("*", jwtMiddleware);
protectedRoutes.post("/logout", logoutHandler);
protectedRoutes.get("/users/me", getUserHandler);
protectedRoutes.post("/products", productPostHandler);
protectedRoutes.get("/cart", getCartHandler);

// エラーハンドリング
app.notFound((c) => c.json({ error: "Not Found" }, 404));

app.onError((err, c) => {
  console.error("Error:", err);
  return c.json(
    {
      error: "Internal Server Error",
      ...(c.env.ENVIRONMENT === "development" && {
        details: err.message,
      }),
    },
    500
  );
});

export default app;
