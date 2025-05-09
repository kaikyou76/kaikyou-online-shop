"use client";

import { useState, useRef, useEffect, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ProductFormData = {
  name: string;
  description: string;
  price: number;
  stock: number;
  category_id?: number;
};

type Category = {
  id: number;
  name: string;
};

const MAX_MAIN_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_ADDITIONAL_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_ADDITIONAL_IMAGES = 5;

export default function ProductCreatePage() {
  const router = useRouter();
  const [formData, setFormData] = useState<ProductFormData>({
    name: "",
    description: "",
    price: 0,
    stock: 0,
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [mainImage, setMainImage] = useState<File | null>(null);
  const [additionalImages, setAdditionalImages] = useState<File[]>([]);
  const [mainImagePreview, setMainImagePreview] = useState<string | null>(null);
  const [additionalPreviews, setAdditionalPreviews] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const additionalInputRef = useRef<HTMLInputElement>(null);

  // カテゴリデータの取得
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
        if (!apiUrl) {
          throw new Error("APIエンドポイントが設定されていません");
        }

        const response = await fetch(`${apiUrl}/api/categories`);
        if (!response.ok) {
          throw new Error("カテゴリの取得に失敗しました");
        }
        const data = await response.json();
        setCategories(data);
      } catch (err) {
        console.error("カテゴリ取得エラー:", err);
        setError(
          err instanceof Error
            ? err.message
            : "カテゴリ取得中にエラーが発生しました"
        );
      }
    };

    fetchCategories();
  }, []);

  // メモリリーク防止
  useEffect(() => {
    return () => {
      if (mainImagePreview) URL.revokeObjectURL(mainImagePreview);
      additionalPreviews.forEach((preview) => URL.revokeObjectURL(preview));
    };
  }, [mainImagePreview, additionalPreviews]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "price" || name === "stock" || name === "category_id"
          ? value === ""
            ? undefined
            : Number(value)
          : value,
    }));
  };

  const handleMainImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;

    const file = e.target.files[0];

    if (file.size > MAX_MAIN_IMAGE_SIZE) {
      setError(
        `メイン画像は${
          MAX_MAIN_IMAGE_SIZE / 1024 / 1024
        }MB以下のサイズにしてください`
      );
      return;
    }

    // 既存のプレビューを解放
    if (mainImagePreview) URL.revokeObjectURL(mainImagePreview);

    setMainImage(file);
    setMainImagePreview(URL.createObjectURL(file));
    setError(null);
  };

  const handleAdditionalImagesChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const newFiles = Array.from(e.target.files);
    const currentCount = additionalImages.length;
    const availableSlots = MAX_ADDITIONAL_IMAGES - currentCount;

    if (newFiles.length > availableSlots) {
      setError(
        `追加画像は最大${MAX_ADDITIONAL_IMAGES}枚までです。あと${availableSlots}枚追加できます。`
      );
      return;
    }

    // サイズチェック
    for (const file of newFiles) {
      if (file.size > MAX_ADDITIONAL_IMAGE_SIZE) {
        setError(
          `追加画像は${
            MAX_ADDITIONAL_IMAGE_SIZE / 1024 / 1024
          }MB以下のサイズにしてください`
        );
        return;
      }
    }

    const combinedFiles = [...additionalImages, ...newFiles];
    const combinedPreviews = [
      ...additionalPreviews,
      ...newFiles.map((file) => URL.createObjectURL(file)),
    ];

    setAdditionalImages(combinedFiles);
    setAdditionalPreviews(combinedPreviews);
    setError(null);

    // 入力値をリセット
    if (additionalInputRef.current) additionalInputRef.current.value = "";
  };

  const removeAdditionalImage = (index: number) => {
    const newFiles = [...additionalImages];
    newFiles.splice(index, 1);

    const newPreviews = [...additionalPreviews];
    URL.revokeObjectURL(newPreviews[index]);
    newPreviews.splice(index, 1);

    setAdditionalImages(newFiles);
    setAdditionalPreviews(newPreviews);
    setError(null);
  };

  const resetForm = () => {
    setFormData({ name: "", description: "", price: 0, stock: 0 });
    setMainImage(null);
    if (mainImagePreview) URL.revokeObjectURL(mainImagePreview);
    setMainImagePreview(null);
    additionalPreviews.forEach((preview) => URL.revokeObjectURL(preview));
    setAdditionalImages([]);
    setAdditionalPreviews([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // バリデーション
      if (!formData.name.trim()) throw new Error("商品名を入力してください");
      if (formData.price <= 0)
        throw new Error("価格は0より大きい値を入力してください");
      if (!mainImage) throw new Error("メイン画像を選択してください");

      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!apiUrl) throw new Error("APIエンドポイントが設定されていません");

      const formDataToSend = new FormData();

      // 商品情報
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== undefined) formDataToSend.append(key, value.toString());
      });

      // 画像データ
      formDataToSend.append("mainImage", mainImage);
      additionalImages.forEach((file) =>
        formDataToSend.append("additionalImages", file)
      );

      // APIリクエスト
      const response = await fetch(`${apiUrl}/api/products`, {
        method: "POST",
        body: formDataToSend,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "商品登録に失敗しました");
      }

      const result = await response.json();
      resetForm();
      router.push(`/product/${result.id}`);
    } catch (err) {
      console.error("商品登録エラー:", err);
      setError(
        err instanceof Error ? err.message : "商品登録中にエラーが発生しました"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto bg-background text-foreground">
      <h1 className="text-2xl font-bold mb-6">新規商品登録</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-md dark:bg-red-900 dark:text-red-100">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 商品基本情報 */}
        <div>
          <label className="block mb-1 font-medium text-gray-700 dark:text-gray-300">
            商品名<span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          />
        </div>

        <div>
          <label className="block mb-1 font-medium text-gray-700 dark:text-gray-300">
            説明
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            rows={4}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 font-medium text-gray-700 dark:text-gray-300">
              価格<span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="price"
              value={formData.price || ""}
              onChange={handleChange}
              min="1"
              step="1"
              required
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block mb-1 font-medium text-gray-700 dark:text-gray-300">
              在庫数
            </label>
            <input
              type="number"
              name="stock"
              value={formData.stock || ""}
              onChange={handleChange}
              min="0"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            />
          </div>
        </div>

        {/* カテゴリ選択 */}
        <div>
          <label className="block mb-1 font-medium text-gray-700 dark:text-gray-300">
            カテゴリ
          </label>
          <select
            name="category_id"
            value={formData.category_id ?? ""}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          >
            <option value="">--カテゴリを選択--</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        {/* 画像アップロード */}
        <div>
          <label className="block mb-1 font-medium text-gray-700 dark:text-gray-300">
            メイン画像<span className="text-red-500">*</span>
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleMainImageChange}
            required
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          />
          <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">
            {MAX_MAIN_IMAGE_SIZE / 1024 / 1024}MB以下の画像を選択してください
          </p>
          {mainImagePreview && (
            <div className="mt-2">
              <p className="text-sm text-gray-500 mb-1 dark:text-gray-400">
                プレビュー:
              </p>
              <img
                src={mainImagePreview}
                alt="メイン画像プレビュー"
                className="h-40 object-contain border rounded-md"
              />
            </div>
          )}
        </div>

        <div>
          <label className="block mb-1 font-medium text-gray-700 dark:text-gray-300">
            追加画像 (最大{MAX_ADDITIONAL_IMAGES}枚)
          </label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleAdditionalImagesChange}
            ref={additionalInputRef}
            disabled={additionalImages.length >= MAX_ADDITIONAL_IMAGES}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          />
          <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">
            {MAX_ADDITIONAL_IMAGE_SIZE / 1024 / 1024}
            MB以下の画像を選択してください (残り
            {MAX_ADDITIONAL_IMAGES - additionalImages.length}枚追加可能)
          </p>
          {additionalPreviews.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-gray-500 mb-1 dark:text-gray-400">
                追加画像プレビュー:
              </p>
              <div className="flex flex-wrap gap-2">
                {additionalPreviews.map((preview, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={preview}
                      alt={`追加画像プレビュー ${index + 1}`}
                      className="h-24 w-24 object-cover border rounded-md"
                    />
                    <button
                      type="button"
                      onClick={() => removeAdditionalImage(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                      aria-label="画像を削除"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 送信ボタン */}
        <div className="flex space-x-4 pt-6">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-blue-300 transition-colors shadow-md flex justify-center items-center dark:bg-blue-700 dark:hover:bg-blue-800"
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                登録中...
              </>
            ) : (
              "商品を登録"
            )}
          </button>

          <Link
            href="/"
            className="flex-1 text-center bg-gray-200 text-gray-800 py-3 px-4 rounded-md hover:bg-gray-300 transition-colors shadow-md dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  );
}
