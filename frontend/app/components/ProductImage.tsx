"use client";

import { useState, useCallback } from "react";

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
    <img
      src={imgSrc}
      alt={alt}
      className="w-full h-full object-cover hover:scale-105 transition duration-300"
      onError={() => setImgSrc(getPlaceholderImage(id))}
    />
  );
}
