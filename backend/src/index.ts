// backend/src/index.ts
import 'dotenv/config';
import { Hono } from "hono";
import { productPostHandler } from "endpoints/productCreate";
import { productGetHandler } from "endpoints/productGet";
import { getCartHandler } from "endpoints/getCart";
import { jwtMiddleware } from "./middleware/jwt";

type Bindings = {
  DB: D1Database;
};

type Variables = {
  jwtPayload?: {
    user_id: number;
    email: string;
  };
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// =====================
// Global Middlewares
// =====================
app.use('*', async (c, next) => {
  // CORS Preflight
  if (c.req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-ID',
        'Access-Control-Max-Age': '86400',
      },
    });
  }
  
  await next();
  
  // CORS Headers for actual requests
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Vary', 'Origin');
});

// JWT Middleware (適用が必要なルートのみ)
app.use('/api/cart', jwtMiddleware);

// =====================
// API Routes
// =====================
// Product API
app.post('/api/products', productPostHandler)
   .get('/api/products', productGetHandler);

// Cart API
app.get('/api/cart', getCartHandler)
   .post('/api/cart', /* cartPostHandler */)
   .delete('/api/cart/:productId', /* cartDeleteHandler */);

// =====================
// Health Check
// =====================
app.get('/health', (c) => c.json({ status: 'healthy' }));

// =====================
// Error Handling
// =====================
app.onError((err, c) => {
  console.error('Global Error:', err);
  return c.json(
    {
      error: {
        message: 'Internal Server Error',
        details: process.env.NODE_ENV === 'development' 
          ? { error: err.message } 
          : undefined
      }
    },
    500
  );
});

export default app;
