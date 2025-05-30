// backend/src/lib/storage.ts
import { createId } from "@paralleldrive/cuid2";
import type { R2Bucket } from "@cloudflare/workers-types";

export interface StorageResult {
  url: string;
  key: string;
}
export interface UploadOptions {
  folder?: string;
  fileName?: string;
}

export const uploadToR2 = async (
  bucket: R2Bucket,
  file: File,
  publicDomain: string,
  options: UploadOptions = {}
): Promise<StorageResult> => {
  const { folder = "uploads", fileName } = options;
  const fileExt = file.name.split(".").pop();

  // ファイル名生成ロジック
  const key = fileName
    ? `${folder}/${fileName}.${fileExt}`
    : `${folder}/${createId()}.${fileExt}`;

  await bucket.put(key, file, {
    httpMetadata: {
      contentType: file.type,
    },
  });

  return {
    url: `https://${publicDomain}/${key}`,
    key,
  };
};
// 簡易版取得関数
export const getFromR2 = async (
  bucket: R2Bucket,
  key: string
): Promise<ReadableStream | null> => {
  const object = await bucket.get(key);
  return object?.body ?? null;
};

/**
 * R2からオブジェクトを削除
 * @param bucket R2Bucketインスタンス
 * @param keyOrUrl 削除対象のキーまたは公開URL
 * @returns 削除成功時はtrue、失敗時はfalse
 *
 * 使用例:
 * // キー指定で削除
 * await deleteFromR2(bucket, "products/main/clxyz4567890.jpg");
 *
 * // URL指定で削除
 * await deleteFromR2(bucket, "https://pub.example.com/products/main/clxyz4567890.jpg");
 */
export const deleteFromR2 = async (
  bucket: R2Bucket,
  keyOrUrl: string
): Promise<boolean> => {
  try {
    // URLが渡された場合、ドメイン部分を除去してキーを抽出
    const key = keyOrUrl.startsWith("http")
      ? new URL(keyOrUrl).pathname.slice(1) // 先頭のスラッシュを除去
      : keyOrUrl;

    // オブジェクト存在確認（任意。削除前に確認したい場合）
    const object = await bucket.head(key);
    if (!object) {
      console.warn(`[R2_DELETE] オブジェクトが存在しません: ${key}`);
      return false;
    }

    await bucket.delete(key);
    console.log(`[R2_DELETE] 削除成功: ${key}`);
    return true;
  } catch (error) {
    console.error(`[R2_DELETE_ERROR] ${keyOrUrl}`, error);
    // エラータイプに応じた処理（必要に応じて拡張）
    if (error instanceof Error) {
      if (error.message.includes("No such key")) {
        console.warn(`[R2_DELETE] オブジェクトが既に存在しません: ${keyOrUrl}`);
      } else {
        console.error(`[R2_DELETE_CRITICAL] ${error.message}`);
      }
    }
    return false;
  }
};
