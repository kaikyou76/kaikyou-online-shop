// frontend/components/ProductImage.tsx
"use client";

import { useState, useCallback } from "react";
import Image from "next/image";

type ProductImageProps = {
  id: number;
  imageUrl?: string;
  alt: string;
  className?: string;
  priority?: boolean;
};

export default function ProductImage({
  id,
  imageUrl,
  alt,
  className = "",
  priority = false,
}: ProductImageProps) {
  const getPlaceholderImage = useCallback((id: number) => {
    const imageIndex = (id % 5) + 1;
    return `/placeholder-${imageIndex}.jpg`;
  }, []);

  const [imgSrc, setImgSrc] = useState(imageUrl || getPlaceholderImage(id));
  const [isError, setIsError] = useState(false);

  // 正規化されたドメイン取得（https:// を除去）
  const r2Domain =
    process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN?.replace(/^https?:\/\//, "") || "";
  const isR2Image = r2Domain && imgSrc.includes(r2Domain);

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      <Image
        src={isError ? getPlaceholderImage(id) : imgSrc}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        className="object-cover hover:scale-105 transition duration-300"
        onError={() => {
          setIsError(true);
          setImgSrc(getPlaceholderImage(id));
        }}
        unoptimized={!isR2Image}
        priority={priority}
      />
    </div>
  );
}
