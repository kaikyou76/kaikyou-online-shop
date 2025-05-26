// frontend/components/ProductImageUpload.tsx
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import {
  TrashIcon,
  PhotoIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

interface ImageItem {
  id: number; // 常に数値ID（既存: 正の数, 新規: 負の数）
  file?: File; // 新規画像のみ
  url: string; // 表示用URL
}

interface ProductImageUploadProps {
  mainImage?: { id: number; url: string }; // 数値ID必須に変更
  additionalImages?: { id: number; url: string }[]; // 数値ID必須に変更
  onImagesChange: (data: {
    main?: { id: number; file?: File; url: string }; // ✅ `url` を追加
    additional?: { id: number; file?: File; url: string }[]; // ✅ `url` を追加
    deletedImageIds: number[];
    keepImageIds: number[]; // 追加
  }) => void;
}

export function ProductImageUpload({
  mainImage,
  additionalImages = [],
  onImagesChange,
}: ProductImageUploadProps) {
  // メイン画像（数値ID管理）
  const [mainImg, setMainImg] = useState<{
    id: number;
    file?: File;
    url: string;
  }>(mainImage || { id: -1, url: "" });

  // 追加画像（数値ID管理）
  const [additionalImgs, setAdditionalImgs] = useState<ImageItem[]>(
    additionalImages.map((img) => ({ id: img.id, url: img.url }))
  );

  // 削除予定IDリスト
  const [deletedImageIds, setDeletedImageIds] = useState<number[]>([]);
  const tempIdCounter = useRef(-1); // 新規画像用仮IDカウンター

  useEffect(() => {
    return () => {
      // メイン画像のオブジェクトURL解放
      if (mainImg.id < 0 && mainImg.url) {
        URL.revokeObjectURL(mainImg.url);
      }

      // 追加画像のオブジェクトURL解放
      additionalImgs.forEach((img) => {
        if (img.id < 0 && img.url) {
          URL.revokeObjectURL(img.url);
        }
      });
    };
  }, []); // 空の依存配列

  // メイン画像変更ハンドラー
  const handleMainImageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
        const file = e.target.files[0];

        setMainImg((prev) => {
          // 前の画像が新規の場合（負のID）URL解放
          if (prev.id < 0 && prev.url) {
            URL.revokeObjectURL(prev.url);
          }

          // 既存画像があれば削除リスト追加
          if (prev.id > 0) {
            setDeletedImageIds((d) => [...d, prev.id]);
          }

          return {
            id: tempIdCounter.current--,
            file,
            url: URL.createObjectURL(file),
          };
        });
      }
    },
    []
  );

  // 追加画像変更ハンドラー
  const handleAdditionalImagesChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        const newItems = Array.from(e.target.files).map((file) => ({
          id: tempIdCounter.current--, // 新規は負のID
          file,
          url: URL.createObjectURL(file),
        }));
        setAdditionalImgs((prev) => [...prev, ...newItems]);
      }
    },
    []
  );

  // メイン画像リセット
  const resetMainImage = useCallback(() => {
    if (mainImg.id > 0) {
      setDeletedImageIds((d) => [...d, mainImg.id]);
    } else if (mainImg.url) {
      URL.revokeObjectURL(mainImg.url); // 新規画像のメモリ解放
    }
    setMainImg({ id: -1, url: "" });
  }, [mainImg]);

  // 追加画像削除
  const removeAdditionalImage = useCallback((id: number) => {
    setAdditionalImgs((prev) => {
      const removedImg = prev.find((img) => img.id === id);

      // 削除対象が既存画像（正のID）の場合のみdeletedImageIdsに追加
      if (removedImg?.id && removedImg.id > 0) {
        setDeletedImageIds((prevIds) => [...prevIds, removedImg.id]);
      }

      // 新規画像（負のID）の場合、オブジェクトURLを解放
      if (removedImg?.id && removedImg.id < 0 && removedImg.url) {
        URL.revokeObjectURL(removedImg.url);
      }

      return prev.filter((img) => img.id !== id);
    });
  }, []); // 依存配列は空でOK

  // useEffect内の変更通知処理
  useEffect(() => {
    const currentMainId = mainImg.id;
    const currentAdditionalIds = additionalImgs.map((img) => img.id);

    // 保持するべきIDをフィルタリング（構文エラー修正）
    const validKeepIds = [
      ...(currentMainId > 0 && !deletedImageIds.includes(currentMainId)
        ? [currentMainId]
        : []),
      ...currentAdditionalIds.filter(
        (id) => id > 0 && !deletedImageIds.includes(id)
      ), // ← 閉じ括弧を追加
    ];

    onImagesChange({
      main: mainImg.url
        ? {
            id: mainImg.id,
            url: mainImg.url,
            ...(mainImg.id < 0 && { file: mainImg.file }),
          }
        : undefined,
      additional: additionalImgs.map((img) => ({
        id: img.id,
        url: img.url,
        ...(img.id < 0 && { file: img.file }),
      })),
      deletedImageIds: deletedImageIds,
      keepImageIds: validKeepIds,
    });
  }, [mainImg, additionalImgs, deletedImageIds, onImagesChange]);

  return (
    <div className="space-y-6">
      {/* メイン画像セクション */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          メイン画像
        </label>
        <div className="flex items-start gap-4">
          {mainImg.url ? (
            <div className="relative group">
              <div className="relative w-40 h-40 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                <Image
                  src={mainImg.url}
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
              {mainImg.url ? "メイン画像を変更" : "メイン画像を選択"}
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
              {additionalImgs.map((img) => (
                <div key={img.id} className="relative group aspect-square">
                  <div className="relative w-full h-full rounded-md overflow-hidden border border-gray-200 dark:border-gray-700">
                    <Image
                      src={img.url}
                      alt={`追加画像 ${img.id}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, 20vw"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAdditionalImage(img.id)}
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
