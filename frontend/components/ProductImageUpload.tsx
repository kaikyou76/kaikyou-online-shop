// frontend/components/ProductImageUpload.tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import {
  TrashIcon,
  PhotoIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

interface ProductImageUploadProps {
  mainImage?: string;
  additionalImages?: string[];
  onImagesChange: (data: {
    main?: File | string;
    additional?: (File | string)[];
    deleted?: string[];
  }) => void;
}

export function ProductImageUpload({
  mainImage = "",
  additionalImages = [],
  onImagesChange,
}: ProductImageUploadProps) {
  const [mainImg, setMainImg] = useState<File | string>(mainImage);
  const [additionalImgs, setAdditionalImgs] =
    useState<(File | string)[]>(additionalImages);
  const [deletedImgs, setDeletedImgs] = useState<string[]>([]);

  // メイン画像変更ハンドラー
  const handleMainImageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
        const file = e.target.files[0];
        setMainImg((prev) => {
          if (typeof prev === "string" && prev) {
            setDeletedImgs((d) => [...d, prev]);
          }
          return file;
        });
      }
    },
    []
  );

  // 追加画像変更ハンドラー
  const handleAdditionalImagesChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        const newFiles = Array.from(e.target.files);
        setAdditionalImgs((prev) => [...prev, ...newFiles]);
      }
    },
    []
  );

  // メイン画像リセット
  const resetMainImage = useCallback(() => {
    if (typeof mainImg === "string" && mainImg) {
      setDeletedImgs((d) => [...d, mainImg]);
    }
    setMainImg("");
  }, [mainImg]);

  // 追加画像削除
  const removeAdditionalImage = useCallback(
    (index: number) => {
      const imgToRemove = additionalImgs[index];
      if (typeof imgToRemove === "string") {
        setDeletedImgs((d) => [...d, imgToRemove]);
      }
      setAdditionalImgs((prev) => prev.filter((_, i) => i !== index));
    },
    [additionalImgs]
  );

  // 変更を親コンポーネントに通知
  useEffect(() => {
    onImagesChange({
      main: mainImg,
      additional: additionalImgs,
      deleted: deletedImgs,
    });
  }, [mainImg, additionalImgs, deletedImgs, onImagesChange]);

  // 画像プレビューURL生成
  const getImageUrl = (img: File | string) => {
    if (typeof img === "string") return img;
    return URL.createObjectURL(img);
  };

  return (
    <div className="space-y-6">
      {/* メイン画像セクション */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          メイン画像
        </label>
        <div className="flex items-start gap-4">
          {mainImg ? (
            <div className="relative group">
              <div className="relative w-40 h-40 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                <Image
                  src={getImageUrl(mainImg)}
                  alt="メイン商品画像"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 40vw"
                  priority
                />
              </div>
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={resetMainImage}
                  className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  aria-label="メイン画像を削除"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="w-40 h-40 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
              <PhotoIcon className="h-10 w-10 text-gray-400" />
            </div>
          )}

          <div className="flex-1 flex flex-col justify-center gap-2">
            <label className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer">
              <PhotoIcon className="h-5 w-5 mr-2" />
              {mainImg ? "メイン画像を変更" : "メイン画像を選択"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleMainImageChange}
              />
            </label>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              推奨サイズ: 800×800px 以上
            </p>
          </div>
        </div>
      </div>

      {/* 追加画像セクション */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          追加画像
        </label>
        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4">
          {additionalImgs.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-4">
              {additionalImgs.map((img, index) => (
                <div key={index} className="relative group aspect-square">
                  <div className="relative w-full h-full rounded-md overflow-hidden border border-gray-200 dark:border-gray-700">
                    <Image
                      src={getImageUrl(img)}
                      alt={`追加画像 ${index + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, 20vw"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAdditionalImage(index)}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    aria-label="画像を削除"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                画像をドラッグ＆ドロップするか、下のボタンから選択してください
              </p>
            </div>
          )}

          <label className="inline-flex items-center justify-center px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer">
            <ArrowPathIcon className="h-5 w-5 mr-2" />
            画像を追加
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={handleAdditionalImagesChange}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
