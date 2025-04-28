//backend/src/routes/index.ts
import { Hono } from "hono";
import { productPostHandler } from "endpoints/productCreate";
import { productGetHandler } from "endpoints/productGet";
import { getCartHandler } from "endpoints/getCart";
import { jwtMiddleware } from "middleware/jwt";
import { productGetByIdHandler } from "endpoints/productGetById";
import type { Bindings, Variables } from "types/types";

const app = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

// =====================
// Global Middlewares
// =====================
app.use("*", async (c, next) => {
  // CORS Preflight
  if (c.req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, X-Session-ID",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  await next();

  // CORS Headers
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Vary", "Origin");
});

// =====================
// Authentication Middleware
// =====================
app.use("/api/cart/*", jwtMiddleware);
app.use("/api/products/*", async (c, next) => {
  if (["POST", "PUT", "DELETE"].includes(c.req.method)) {
    return jwtMiddleware(c, next);
  }
  await next();
});

// =====================
// API Routes
// =====================
// Product API
app
  .post("/api/products", productPostHandler)
  .get("/api/products", productGetHandler)
  .get("/api/products/:id", productGetByIdHandler);

// Cart API
app
  .get("/api/cart", getCartHandler)
  .post("/api/cart" /* cartPostHandler */)
  .delete("/api/cart/:productId" /* cartDeleteHandler */);

// =====================
// System Routes
// =====================
app.get("/health", (c) =>
  c.json({
    status: "healthy",
    environment: c.env.ENVIRONMENT,
  })
);

// =====================
// Error Handling
// =====================
app.onError((err, c) => {
  console.error(`[${new Date().toISOString()}] Error:`, err);

  return c.json(
    {
      error: {
        message: "Internal Server Error",
        details:
          c.env.ENVIRONMENT === "development"
            ? {
                error: err.message,
                stack: err.stack,
              }
            : undefined,
      },
    },
    500
  );
});

export default app;
