// frontend/components/ProductImageUpload.tsx
"use client";

import { useFormContext } from "react-hook-form";
import { useEffect, useState, memo, useCallback } from "react";
import Image from "next/image";

type ProductImage = {
  id: number;
  url: string;
  is_main: boolean;
};

type ProductImageUploadProps = {
  mainImage: ProductImage | undefined;
  additionalImages: ProductImage[];
  onMainImageChange: (file: File | null, id: number) => void;
  onAdditionalImageChange: (
    files: Array<{ url: File; is_main: boolean }>,
    ids: number[]
  ) => void;
  onDeleteMainImage: (id: number | null) => void;
  onDeleteAdditionalImage: (index: number, id: number | null) => void;
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

// 画像データの比較関数
const areEqual = (
  prevProps: ProductImageUploadProps,
  nextProps: ProductImageUploadProps
) => {
  return (
    prevProps.mainImage?.id === nextProps.mainImage?.id &&
    prevProps.mainImage?.url === nextProps.mainImage?.url &&
    prevProps.additionalImages.length === nextProps.additionalImages.length &&
    prevProps.additionalImages.every(
      (img, i) =>
        img.id === nextProps.additionalImages[i]?.id &&
        img.url === nextProps.additionalImages[i]?.url
    )
  );
};

const ProductImageUpload = memo(function ProductImageUpload({
  mainImage: propMainImage,
  additionalImages: propAdditionalImages,
  onMainImageChange,
  onAdditionalImageChange,
  onDeleteMainImage,
  onDeleteAdditionalImage,
}: ProductImageUploadProps) {
  const { setValue, watch, getValues } = useFormContext();
  const [localMainImage, setLocalMainImage] = useState(propMainImage);
  const [localAdditionalImages, setLocalAdditionalImages] =
    useState(propAdditionalImages);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalMainImage(propMainImage);
  }, [propMainImage]);

  useEffect(() => {
    setLocalAdditionalImages(propAdditionalImages);
  }, [propAdditionalImages]);

  useEffect(() => {
    const currentValues = getValues();
    const keepIds = [
      ...(localMainImage?.id && localMainImage.id > 0
        ? [localMainImage.id]
        : []),
      ...localAdditionalImages.filter((img) => img.id > 0).map((img) => img.id),
    ];
    setValue("images.keepImageIds", keepIds);

    const deletedIds = currentValues.images.deletedImageIds || [];
    setValue("images.deletedImageIds", deletedIds);
  }, [localMainImage, localAdditionalImages, setValue, getValues]);

  const validateFile = useCallback((file: File): boolean => {
    if (file.size > MAX_IMAGE_SIZE) {
      setError(`${file.name} は5MBを超えています`);
      return false;
    }
    if (!file.type.startsWith("image/")) {
      setError(`${file.name} は画像ファイルではありません`);
      return false;
    }
    return true;
  }, []);

  const handleMainImageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!validateFile(file)) return;

      const newImage = {
        id: -1,
        url: URL.createObjectURL(file),
        is_main: true,
      };

      if (localMainImage?.id && localMainImage.id > 0) {
        setValue("images.deletedImageIds", [
          ...watch("images.deletedImageIds"),
          localMainImage.id,
        ]);
      }

      setLocalMainImage(newImage);
      onMainImageChange(file, newImage.id);
      setError(null);
    },
    [validateFile, localMainImage, setValue, watch, onMainImageChange]
  );

  const handleAdditionalImageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      const validFiles = files.filter(validateFile);

      if (validFiles.length === 0) return;

      const newImages = validFiles.map((file) => ({
        id: -1,
        url: URL.createObjectURL(file),
        is_main: false,
      }));

      setLocalAdditionalImages((prev) => [...prev, ...newImages]);

      // 親コンポーネントへのデータ渡し（型エラー解消）
      onAdditionalImageChange(
        validFiles.map((file) => ({
          url: file, // 実際のFileオブジェクト
          is_main: false,
        })),
        [] // IDリスト（不要なため空配列）
      );
      setError(null);
    },
    [validateFile, onAdditionalImageChange]
  );

  const removeMainImage = useCallback(() => {
    if (localMainImage) {
      if (localMainImage.id > 0) {
        const currentIds = (watch("images.deletedImageIds") ?? []) as number[];
        if (!currentIds.includes(localMainImage.id)) {
          setValue("images.deletedImageIds", [
            ...currentIds,
            localMainImage.id,
          ]);
        }
      }

      onDeleteMainImage(localMainImage.id);

      if (localMainImage.url.startsWith("blob:")) {
        URL.revokeObjectURL(localMainImage.url);
      }
      setLocalMainImage(undefined);
    }
  }, [localMainImage, watch, setValue, onDeleteMainImage]);

  const removeAdditionalImage = useCallback(
    (index: number) => {
      const target = localAdditionalImages[index];
      if (target) {
        // 既存画像のみ削除リストに追加
        if (target.id > 0) {
          const currentIds = watch("images.deletedImageIds") || [];
          if (!currentIds.includes(target.id)) {
            setValue("images.deletedImageIds", [...currentIds, target.id]);
          }
        }

        onDeleteAdditionalImage(index, target.id);
        // オブジェクトURLの解放
        if (target.url.startsWith("blob:")) {
          URL.revokeObjectURL(target.url);
        }
      }
      setLocalAdditionalImages((prev) => prev.filter((_, i) => i !== index));
    },
    [localAdditionalImages, watch, setValue, onDeleteAdditionalImage]
  );

  useEffect(() => {
    return () => {
      if (localMainImage?.url.startsWith("blob:"))
        URL.revokeObjectURL(localMainImage.url);
      localAdditionalImages.forEach((img) => {
        if (img.url.startsWith("blob:")) URL.revokeObjectURL(img.url);
      });
    };
  }, [localMainImage, localAdditionalImages]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-red-500 text-sm p-2 bg-red-50 rounded">
          {error}
        </div>
      )}
      <div>
        <label className="block font-medium mb-2">メイン画像</label>
        {localMainImage && (
          <div className="relative w-full max-w-[400px] h-auto aspect-square border rounded-md overflow-hidden">
            <Image
              src={localMainImage.url}
              alt="メイン商品画像"
              width={600}
              height={600}
              className="object-cover w-full h-full"
              priority
            />
            <button
              type="button"
              onClick={removeMainImage}
              className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors"
              aria-label="メイン画像を削除"
            >
              ×
            </button>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={handleMainImageChange}
          className="mt-2 block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100"
        />
      </div>
      <div>
        <label className="block font-medium mb-2">追加画像</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-2">
          {localAdditionalImages.map((img, index) => (
            <div
              key={`${img.id}-${index}`}
              className="relative aspect-square border rounded-md overflow-hidden group"
            >
              <Image
                src={img.url}
                alt={`追加商品画像 ${index + 1}`}
                width={300}
                height={300}
                className="object-cover w-full h-full"
              />
              <button
                type="button"
                onClick={() => removeAdditionalImage(index)}
                className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                aria-label={`追加画像 ${index + 1} を削除`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleAdditionalImageChange}
          className="mt-2 block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100"
        />
      </div>
    </div>
  );
},
areEqual);

export default ProductImageUpload;
