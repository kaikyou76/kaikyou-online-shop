// backend/src/lib/auth.ts
import { SignJWT, jwtVerify } from "jose";
import { Env, JwtPayload } from "../types/types";

// トークン生成関数
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

// パスワードハッシュ関数（PBKDF2を使用）
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16)); // ランダムなソルト
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
      iterations: 100000, // イテレーション回数
      hash: "SHA-256", // ハッシュアルゴリズム
    },
    keyMaterial,
    256 // ハッシュのビット長
  );

  const hash = new Uint8Array(derivedBits);
  const saltB64 = btoa(String.fromCharCode(...salt));
  const hashB64 = btoa(String.fromCharCode(...hash));

  // ソルト、ハッシュ、アルゴリズム情報を組み合わせて保存
  return `${saltB64}:${hashB64}:100000:SHA-256`;
}

// パスワード検証関数（PBKDF2を使用）
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  const [saltB64, hashB64, iterations, hashAlg] = hashedPassword.split(":");
  if (!saltB64 || !hashB64 || !iterations || !hashAlg) {
    throw new Error("Invalid password format");
  }

  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const expectedHash = Uint8Array.from(atob(hashB64), (c) => c.charCodeAt(0));
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
      iterations: parseInt(iterations, 10),
      hash: hashAlg as string,
    },
    keyMaterial,
    expectedHash.length * 8
  );

  const actualHash = new Uint8Array(derivedBits);
  return crypto.subtle.timingSafeEqual(actualHash, expectedHash);
}
