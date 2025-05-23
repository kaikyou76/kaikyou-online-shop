// frontend/components/ProductImage.tsx
"use client";

import { useState, useMemo } from "react";
import Image, { ImageProps } from "next/image";

type ProductImageProps = {
  id: number;
  imageUrl?: string | null;
  alt: string;
  className?: string;
  priority?: boolean;
  placeholderType?: "default" | "pattern1" | "pattern2";
  unoptimized?: boolean; // 明示的に制御可能に
};

export default function ProductImage({
  id,
  imageUrl,
  alt,
  className = "",
  priority = false,
  placeholderType = "default",
  unoptimized: propUnoptimized,
}: ProductImageProps) {
  // プレースホルダー画像の決定
  const getPlaceholderPath = (type: string) => {
    const index = (id % 5) + 1;
    return `/placeholders/${type}-${index}.jpg`;
  };

  // 画像ソースの状態管理
  const [currentSrc, setCurrentSrc] = useState(
    imageUrl || getPlaceholderPath(placeholderType)
  );
  const [hasError, setHasError] = useState(false);

  // R2ストレージ判定（環境変数から動的に取得）
  const isR2Image = useMemo(() => {
    if (!process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN) return false;
    try {
      const domain = new URL(process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN).hostname;
      return currentSrc.includes(domain);
    } catch {
      return false;
    }
  }, [currentSrc]);

  // 最適化設定の優先順位
  const resolvedUnoptimized = useMemo(() => {
    // 明示的に指定されていれば優先
    if (typeof propUnoptimized !== "undefined") return propUnoptimized;
    // デフォルトはR2画像のみ最適化
    return !isR2Image;
  }, [propUnoptimized, isR2Image]);

  // エラーハンドリング
  const handleError = () => {
    if (!hasError) {
      setCurrentSrc(getPlaceholderPath("default"));
      setHasError(true);
    }
  };

  // 実際に使用する画像ソース
  const finalSrc = hasError ? getPlaceholderPath("default") : currentSrc;

  return (
    <div
      className={`relative w-full h-full overflow-hidden ${className}`}
      data-testid="product-image-container"
    >
      <Image
        src={finalSrc}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        className="object-cover transition-transform duration-300 hover:scale-105"
        onError={handleError}
        unoptimized={resolvedUnoptimized}
        priority={priority}
        quality={priority ? 90 : 75} // priority時に画質向上
      />
    </div>
  );
}
