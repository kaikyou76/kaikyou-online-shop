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
    iterations: 100_000,
    hash: "SHA-512",
    saltLen: 32,
    keyLen: 64,
  },
};

export async function generateAuthToken(
  env: Env,
  userId: number,
  email: string,
  role: string,
  expiresIn = "2h"
): Promise<string> {
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const token = await new SignJWT({ user_id: userId, email, role })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(env.JWT_ISSUER)
      .setAudience(env.JWT_AUDIENCE)
      .setExpirationTime(expiresIn)
      .setIssuedAt()
      .sign(secret);

    debugLog("トークン生成成功", { userId, email, expiresIn });
    return `v1:${token}`; // プレフィックスを付与して返す
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
  const isDev = c.env.ENVIRONMENT === "development";
  const logContext = {
    requestId,
    method: c.req.method,
    path: c.req.path,
    env: c.env.ENVIRONMENT,
  };

  try {
    debugLog("ミドルウェア開始", logContext);

    // 1. Authorization ヘッダーの検証
    const authHeader = c.req.header("Authorization");
    debugLog("認証ヘッダー確認", {
      header: authHeader ? `${authHeader.slice(0, 10)}...` : null,
    });

    if (!authHeader) {
      debugLog("認証ヘッダーなし", logContext);
      return c.json(
        {
          error: {
            code: "MISSING_AUTH_HEADER",
            message: "Authorizationヘッダーが必要です",
          },
        },
        401
      );
    }

    // 2. トークンの抽出と正規化
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : authHeader;
    const normalizedToken = token.startsWith("v1:") ? token.slice(3) : token;

    debugLog("トークン正規化完了", {
      original: token.slice(0, 10) + "..." + token.slice(-10),
      normalized:
        normalizedToken.slice(0, 10) + "..." + normalizedToken.slice(-10),
    });

    // 3. トークン検証
    debugLog("トークン検証開始", logContext);
    const { payload } = await jwtVerify(
      normalizedToken,
      new TextEncoder().encode(c.env.JWT_SECRET),
      {
        issuer: c.env.JWT_ISSUER,
        audience: c.env.JWT_AUDIENCE,
        algorithms: ["HS256"],
        clockTolerance: isDev ? 30 : 15, // 開発環境では緩和
      }
    );

    // 4. ペイロードの型変換と検証
    const userId = Number(payload.user_id);
    const role = payload.role ? String(payload.role) : "user";
    if (isNaN(userId)) {
      debugLog("無効なuser_id形式", {
        original: payload.user_id,
        type: typeof payload.user_id,
      });
      return c.json(
        {
          error: {
            code: "INVALID_USER_ID",
            message: "ユーザーIDが不正です",
          },
        },
        400
      );
    }

    // 5. コンテキストに保存 (型変換済みの値を設定)
    c.set("jwtPayload", {
      user_id: userId,
      email: payload.email ? String(payload.email) : "",
      role,
      exp: Number(payload.exp),
    });

    debugLog("認証成功", {
      user_id: userId,
      type: typeof userId,
    });

    await next();
    debugLog("ミドルウェア完了", logContext);
  } catch (error) {
    debugLog("認証エラー", {
      error: error instanceof Error ? error.message : String(error),
      ...logContext,
    });

    return c.json(
      {
        error: {
          code: "AUTH_FAILURE",
          message: "認証に失敗しました",
          ...(c.env.ENVIRONMENT === "development" && {
            details: error instanceof Error ? error.message : String(error),
          }),
        },
      },
      401
    );
  }
};
