"use client";

import { useState, useCallback } from "react";
import Image from "next/image";

export default function ProductImage({
  id,
  imageUrl,
  alt,
}: {
  id: number;
  imageUrl?: string;
  alt: string;
}) {
  const getPlaceholderImage = useCallback((id: number) => {
    const imageIndex = (id % 5) + 1;
    return `/placeholder-${imageIndex}.jpg`;
  }, []);

  const [imgSrc, setImgSrc] = useState(imageUrl || getPlaceholderImage(id));

  return (
    <div className="w-full h-full overflow-hidden">
      <Image
        src={imgSrc}
        alt={alt}
        width={500} // 適切な幅を指定
        height={500} // 適切な高さを指定
        className="w-full h-full object-cover hover:scale-105 transition duration-300"
        onError={() => setImgSrc(getPlaceholderImage(id))}
        unoptimized={!imgSrc.startsWith("/")} // 外部URLの場合最適化を無効化
      />
    </div>
  );
}
