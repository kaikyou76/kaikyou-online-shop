// lib/security.ts

/**
 * 安全な暗号化/復号化ユーティリティ
 *
 * 注意: クライアントサイド暗号化は完全なセキュリティを保証するものではありません。
 * 重要なデータは常にサーバーサイドで処理するべきです。
 */

const ENCRYPTION_VERSION = "v1";
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;

// ランダムなバイト列を生成
const getRandomBytes = (length: number): Uint8Array => {
  if (typeof window !== "undefined" && window.crypto) {
    return window.crypto.getRandomValues(new Uint8Array(length));
  }
  throw new Error("Crypto API not available");
};

// パスワードから鍵を導出 (PBKDF2)
const deriveKey = async (
  password: string,
  salt: Uint8Array,
  iterations: number,
  length: number,
  hash: string = "SHA-256"
): Promise<CryptoKey> => {
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash,
    },
    keyMaterial,
    { name: "AES-GCM", length },
    false,
    ["encrypt", "decrypt"]
  );
};

/**
 * データを暗号化
 * @param {string} plaintext - 暗号化するテキスト
 * @param {string} secret - 暗号化キー (環境変数などから取得)
 * @returns {Promise<string>} 暗号化された文字列 (version:salt:iv:ciphertext)
 */
export const encryptData = async (
  plaintext: string,
  secret: string = process.env.NEXT_PUBLIC_ENCRYPTION_SECRET || "default-secret"
): Promise<string> => {
  try {
    if (!plaintext) return "";

    const salt = getRandomBytes(SALT_LENGTH);
    const iv = getRandomBytes(IV_LENGTH);
    const key = await deriveKey(secret, salt, PBKDF2_ITERATIONS, KEY_LENGTH);

    const encoder = new TextEncoder();
    const encoded = encoder.encode(plaintext);

    const ciphertext = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
      },
      key,
      encoded
    );

    // バイナリデータをBase64文字列に変換
    const saltB64 = btoa(String.fromCharCode(...salt));
    const ivB64 = btoa(String.fromCharCode(...iv));
    const ciphertextB64 = btoa(
      String.fromCharCode(...new Uint8Array(ciphertext))
    );

    return `${ENCRYPTION_VERSION}:${saltB64}:${ivB64}:${ciphertextB64}`;
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Data encryption failed");
  }
};

/**
 * 暗号化データを復号化
 * @param {string} encrypted - 暗号化された文字列 (version:salt:iv:ciphertext)
 * @param {string} secret - 暗号化キー
 * @returns {Promise<string>} 復号化された文字列
 */
export const decryptData = async (
  encrypted: string,
  secret: string = process.env.NEXT_PUBLIC_ENCRYPTION_SECRET || "default-secret"
): Promise<string> => {
  try {
    if (!encrypted) return "";

    const [version, saltB64, ivB64, ciphertextB64] = encrypted.split(":");

    if (version !== ENCRYPTION_VERSION) {
      throw new Error("Encryption version mismatch");
    }

    // Base64文字列をバイナリデータに変換
    const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
    const ciphertext = Uint8Array.from(atob(ciphertextB64), (c) =>
      c.charCodeAt(0)
    );

    const key = await deriveKey(secret, salt, PBKDF2_ITERATIONS, KEY_LENGTH);

    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
      },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Data decryption failed");
  }
};

/**
 * 簡易ハッシュ生成 (データ検証用)
 * @param {string} data
 * @returns {Promise<string>} SHA-256ハッシュ
 */
export const generateHash = async (data: string): Promise<string> => {
  const encoder = new TextEncoder();
  const buffer = await window.crypto.subtle.digest(
    "SHA-256",
    encoder.encode(data)
  );
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

/**
 * 安全なトークン生成
 * @param {number} length - トークン長さ (デフォルト32)
 * @returns {string} ランダムトークン
 */
export const generateSecureToken = (length: number = 32): string => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const randomValues = getRandomBytes(length);
  return Array.from(randomValues)
    .map((byte) => chars[byte % chars.length])
    .join("");
};

// 使用例
/*
const example = async () => {
  const secret = 'my-strong-secret';
  const original = 'sensitive-data';
  
  // 暗号化
  const encrypted = await encryptData(original, secret);
  console.log('Encrypted:', encrypted);
  
  // 復号化
  const decrypted = await decryptData(encrypted, secret);
  console.log('Decrypted:', decrypted);
  
  // ハッシュ生成
  const hash = await generateHash(original);
  console.log('Hash:', hash);
  
  // トークン生成
  const token = generateSecureToken();
  console.log('Token:', token);
};
*/
