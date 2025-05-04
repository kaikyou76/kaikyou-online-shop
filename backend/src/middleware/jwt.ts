// backend/src/middleware/jwt.ts
import { SignJWT, jwtVerify } from "jose";
import { MiddlewareHandler } from "hono";
import { Env, JwtPayload } from "../types/types";
import { Buffer } from "buffer";

// パスワードハッシュ設定型
type Pbkdf2Config = {
  iterations: number;
  hash: "SHA-256" | "SHA-512";
  saltLen: number;
  keyLen: number;
};

// 環境別PBKDF2設定
const PBKDF2_CONFIG: Record<string, Pbkdf2Config> = {
  development: {
    iterations: 100_000,
    hash: "SHA-256",
    saltLen: 16,
    keyLen: 32,
  },
  production: {
    iterations: 600_000,
    hash: "SHA-512",
    saltLen: 32,
    keyLen: 64,
  },
};

// 認証トークン生成
export async function generateAuthToken(
  env: Env,
  userId: number,
  email: string,
  expiresIn = "2h"
): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  return new SignJWT({ user_id: userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(secret);
}

// パスワードハッシュ生成
export async function hashPassword(
  password: string,
  env: Env
): Promise<string> {
  const config = PBKDF2_CONFIG[env.ENVIRONMENT] || PBKDF2_CONFIG.production;
  const salt = crypto.getRandomValues(new Uint8Array(config.saltLen));
  const encoder = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: config.iterations,
      hash: config.hash,
    },
    keyMaterial,
    config.keyLen * 8
  );

  const hash = new Uint8Array(derivedBits);
  const saltB64 = Buffer.from(salt).toString("base64");
  const hashB64 = Buffer.from(hash).toString("base64");

  return `${saltB64}:${hashB64}:${config.iterations}:${config.hash}`;
}

// タイミングセーフ比較（Node.jsやCloudflare対応）
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

// パスワード検証
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  try {
    const [saltB64, hashB64, iterationsStr, hashAlgStr] =
      hashedPassword.split(":");
    if (!saltB64 || !hashB64 || !iterationsStr || !hashAlgStr) {
      throw new Error("Invalid password format");
    }

    const salt = new Uint8Array(Buffer.from(saltB64, "base64"));
    const expectedHash = new Uint8Array(Buffer.from(hashB64, "base64"));
    const iterations = parseInt(iterationsStr, 10);
    const encoder = new TextEncoder();

    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations,
        hash: hashAlgStr as "SHA-256" | "SHA-512",
      },
      keyMaterial,
      expectedHash.length * 8
    );

    const actualHash = new Uint8Array(derivedBits);
    return timingSafeEqual(actualHash, expectedHash);
  } catch (error) {
    console.error("Password verification error:", error);
    return false;
  }
}

// JWT 検証ミドルウェア
export const jwtMiddleware: MiddlewareHandler<{
  Bindings: Env;
  Variables: {
    jwtPayload?: JwtPayload;
  };
}> = async (c, next) => {
  // 1. Authorization ヘッダーの検証
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    c.status(401);
    c.header("WWW-Authenticate", "Bearer");
    c.header("X-Content-Type-Options", "nosniff");
    return c.json({
      success: false,
      error: {
        code: "INVALID_AUTH_HEADER",
        message: "Authorization: Bearer <token> 形式が必要です",
        ...(c.env.ENVIRONMENT === "development" && {
          details: "Missing or malformed Authorization header",
        }),
      },
    });
  }

  // 2. トークンの抽出と検証
  const token = authHeader.split(" ")[1];

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(c.env.JWT_SECRET),
      {
        issuer: c.env.JWT_ISSUER,
        audience: c.env.JWT_AUDIENCE,
        clockTolerance: 15,
        algorithms: ["HS256"],
        maxTokenAge: "2h",
      }
    );

    // 3. ペイロードの必須項目確認
    if (
      typeof payload.user_id !== "number" ||
      typeof payload.email !== "string"
    ) {
      throw new Error("JWT payload missing required claims");
    }

    // 4. Context にユーザー情報を保存
    c.set("jwtPayload", {
      user_id: payload.user_id,
      email: payload.email,
      exp: payload.exp ?? Math.floor(Date.now() / 1000) + 7200,
    });

    await next();
  } catch (error) {
    //  5. 認証エラー時のレスポンス
    c.status(401);
    c.header("Cache-Control", "no-store");
    c.header("X-Content-Type-Options", "nosniff");

    return c.json({
      success: false,
      error: {
        code: "AUTH_FAILURE",
        message: "認証に失敗しました",
        ...(c.env.ENVIRONMENT === "development" && {
          details: error instanceof Error ? error.message : "Unknown error",
        }),
      },
    });
  }
};
