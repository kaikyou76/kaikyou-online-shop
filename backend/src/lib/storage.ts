//backend/src/lib/storage.ts
import { createId } from "@paralleldrive/cuid2";
import type { R2Bucket } from "@cloudflare/workers-types";

export interface StorageResult {
  url: string;
  key: string;
}

export const uploadToR2 = async (
  bucket: R2Bucket,
  file: File,
  publicDomain: string,
  options: { folder?: string } = {}
): Promise<StorageResult> => {
  const { folder = "uploads" } = options;
  const fileExt = file.name.split(".").pop();
  const key = `${folder}/${createId()}.${fileExt}`;

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
