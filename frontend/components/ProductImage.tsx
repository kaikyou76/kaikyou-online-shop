// frontend/components/ProductImage.tsx
"use client";

import { useState, useCallback } from "react";
import Image from "next/image";

type ProductImageProps = {
  id: number;
  imageUrl?: string;
  alt: string;
  className?: string; // 追加
};

export default function ProductImage({
  id,
  imageUrl,
  alt,
  className = "", // デフォルト値追加
}: ProductImageProps) {
  const getPlaceholderImage = useCallback((id: number) => {
    const imageIndex = (id % 5) + 1;
    return `/placeholder-${imageIndex}.jpg`;
  }, []);

  const [imgSrc, setImgSrc] = useState(imageUrl || getPlaceholderImage(id));

  return (
    <div className={`w-full h-full overflow-hidden ${className}`}>
      <Image
        src={imgSrc}
        alt={alt}
        width={500}
        height={500}
        className="w-full h-full object-cover hover:scale-105 transition duration-300"
        onError={() => setImgSrc(getPlaceholderImage(id))}
        unoptimized={!imgSrc.startsWith("/")}
      />
    </div>
  );
}
