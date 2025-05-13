// backend/src/middleware/jwt.ts
import { SignJWT, jwtVerify } from "jose";
import { MiddlewareHandler } from "hono";
import { Env, JwtPayload } from "../types/types";
import { Buffer } from "buffer";

// デバッグ用ロガー
const debugLog = (message: string, data?: any) => {
  console.log(
    `[${new Date().toISOString()}] [JWT] ${message}`,
    JSON.stringify(data, null, 2)
  );
};

// エラーロガー
const errorLog = (error: Error, context?: any) => {
  console.error(`[${new Date().toISOString()}] [JWT ERROR] ${error.message}`, {
    stack: error.stack,
    context,
  });
};

type Pbkdf2Config = {
  iterations: number;
  hash: "SHA-256" | "SHA-512";
  saltLen: number;
  keyLen: number;
};

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

export async function generateAuthToken(
  env: Env,
  userId: number,
  email: string,
  expiresIn = "2h"
): Promise<string> {
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const token = await new SignJWT({ user_id: userId, email })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(env.JWT_ISSUER)
      .setAudience(env.JWT_AUDIENCE)
      .setExpirationTime(expiresIn)
      .setIssuedAt()
      .sign(secret);

    debugLog("トークン生成成功", { userId, email, expiresIn });
    return token;
  } catch (error) {
    errorLog(error instanceof Error ? error : new Error(String(error)), {
      userId,
      email,
    });
    throw new Error("トークン生成に失敗しました");
  }
}

export async function hashPassword(
  password: string,
  env: Env
): Promise<string> {
  const config = PBKDF2_CONFIG[env.ENVIRONMENT] || PBKDF2_CONFIG.production;

  debugLog("パスワードハッシュ処理開始", {
    env: env.ENVIRONMENT,
    config,
  });

  try {
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

    const result = `${saltB64}:${hashB64}:${config.iterations}:${config.hash}`;
    debugLog("パスワードハッシュ生成成功", {
      result: result.slice(0, 10) + "...",
    });
    return result;
  } catch (error) {
    errorLog(error instanceof Error ? error : new Error(String(error)));
    throw new Error("パスワードハッシュ生成に失敗しました");
  }
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  try {
    debugLog("パスワード検証開始", {
      hashedPassword: hashedPassword.slice(0, 10) + "...",
    });

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
    const isValid = timingSafeEqual(actualHash, expectedHash);

    debugLog("パスワード検証結果", { isValid });
    return isValid;
  } catch (error) {
    errorLog(error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

export const jwtMiddleware: MiddlewareHandler<{
  Bindings: Env;
  Variables: {
    jwtPayload?: JwtPayload;
  };
}> = async (c, next) => {
  const requestId = Math.random().toString(36).substring(2, 8);
  const logContext = {
    requestId,
    method: c.req.method,
    path: c.req.path,
    env: c.env.ENVIRONMENT,
  };

  debugLog("ミドルウェア開始", logContext);

  // 1. Authorization ヘッダーの検証
  const authHeader = c.req.header("Authorization");
  debugLog("認証ヘッダー確認", {
    header: authHeader ? `${authHeader.slice(0, 10)}...` : null,
  });

  if (!authHeader?.startsWith("Bearer ")) {
    const error = new Error("Authorizationヘッダーが不正");
    errorLog(error, logContext);

    c.status(401);
    c.header("WWW-Authenticate", "Bearer");
    return c.json({
      success: false,
      error: {
        code: "INVALID_AUTH_HEADER",
        message: "Authorization: Bearer <token> 形式が必要です",
      },
    });
  }

  // 2. トークンの抽出
  const token = authHeader.split(" ")[1];
  debugLog("トークン抽出", {
    token: token.slice(0, 10) + "..." + token.slice(-10),
  });

  try {
    // 3. トークン検証
    debugLog("トークン検証開始", logContext);
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(c.env.JWT_SECRET),
      {
        issuer: c.env.JWT_ISSUER,
        audience: c.env.JWT_AUDIENCE,
        algorithms: ["HS256"],
      }
    );

    debugLog("トークンペイロード", {
      user_id: payload.user_id,
      email: payload.email,
      exp: payload.exp,
    });

    // 4. ペイロード検証
    if (
      typeof payload.user_id !== "number" ||
      typeof payload.email !== "string"
    ) {
      throw new Error("必須クレームが不足しています");
    }

    // 5. コンテキストに保存
    c.set("jwtPayload", {
      user_id: payload.user_id,
      email: payload.email,
      exp: payload.exp,
    });

    debugLog("認証成功", { user_id: payload.user_id });
    await next();
    debugLog("ミドルウェア完了", logContext);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    errorLog(err, {
      ...logContext,
      token: token.slice(0, 10) + "..." + token.slice(-10),
    });

    c.status(401);
    return c.json({
      success: false,
      error: {
        code: "AUTH_FAILURE",
        message: "認証に失敗しました",
        ...(c.env.ENVIRONMENT === "development" && {
          details: err.message,
        }),
      },
    });
  }
};
