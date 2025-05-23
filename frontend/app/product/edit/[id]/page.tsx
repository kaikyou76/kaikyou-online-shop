// frontend/app/product/edit/[id]/page.tsx
"use client";

import { ArrowLeftIcon, CheckIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { redirect, useRouter } from "next/navigation";
import { ProductImageUpload } from "../../../../components/ProductImageUpload";
import { useAuth } from "../../../../components/AuthProvider";
import { useState, useEffect, useCallback } from "react";

type ProductFormData = {
  name: string;
  description: string;
  price: number;
  stock: number;
  category?: string;
  images?: {
    main?: File | string;
    additional?: (File | string)[];
    deleted?: string[];
    keepImageIds?: string[];
  };
};

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  images?: {
    main?: {
      id: number;
      url: string;
      is_main: boolean;
    };
    additional?: {
      id: number;
      url: string;
      is_main: boolean;
    }[];
  };
  category?: string;
  createdAt: string;
}

export default function ProductEditPage({
  params,
}: {
  params: { id: string };
}) {
  const { currentUser, isLoggedIn, isLoading: authLoading } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<ProductFormData | null>(null);
  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8787";

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`${baseUrl}/api/products/${params.id}`, {
          headers: { Accept: "application/json" },
        });

        if (!res.ok) throw new Error("Product not found");
        const data = await res.json();
        setProduct(data);

        // 型定義
        interface ImageData {
          id: string | number;
          url: string;
          // 他の必要なプロパティがあれば追加
        }
        interface ProductImages {
          main?: ImageData;
          additional?: ImageData[];
        }
        // フォーム初期データ設定
        setFormData({
          name: data.name,
          description: data.description,
          price: data.price,
          stock: data.stock,
          category: data.category,
          images: {
            main: data.images?.main?.url,
            additional:
              data.images?.additional?.map((img: ImageData) => img.url) || [],
            deleted: [],
            keepImageIds: [
              data.images?.main?.id,
              ...(data.images?.additional?.map((img: ImageData) => img.id) ||
                []),
            ]
              .filter(Boolean)
              .map(String),
          },
        });
      } catch (error) {
        console.error("商品取得エラー:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [params.id, baseUrl]);

  const updateProduct = async (data: ProductFormData) => {
    const token = localStorage.getItem("jwtToken");
    if (!token) throw new Error("認証トークンがありません");

    try {
      const formPayload = new FormData();
      formPayload.append("name", data.name);
      formPayload.append("description", data.description);
      formPayload.append("price", data.price.toString());
      formPayload.append("stock", data.stock.toString());

      if (data.category) {
        formPayload.append("category_id", data.category);
      }

      // 画像処理
      if (data.images?.main instanceof File) {
        formPayload.append("mainImage", data.images.main);
      }

      if (data.images?.additional) {
        data.images.additional.forEach((file) => {
          if (file instanceof File) {
            formPayload.append("additionalImages", file);
          }
        });
      }

      if (data.images?.keepImageIds) {
        formPayload.append(
          "keepImageIds",
          JSON.stringify(data.images.keepImageIds)
        );
      }

      if (data.images?.deleted && data.images.deleted.length > 0) {
        formPayload.append(
          "deletedImages",
          JSON.stringify(data.images.deleted)
        );
      }

      // デバッグ用: FormData内容確認
      for (let [key, value] of formPayload.entries()) {
        console.log(key, value instanceof File ? value.name : value);
      }

      const res = await fetch(`${baseUrl}/api/products/${params.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formPayload,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error?.message || `更新失敗: ${res.status}`);
      }

      return await res.json();
    } catch (error) {
      console.error("商品更新エラー:", error);
      throw error;
    }
  };
  const router = useRouter();
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData) return;

    try {
      await updateProduct(formData);

      router.push(`/product/${params.id}`);
    } catch (error) {
      console.error("更新処理エラー:", error);
      alert(
        error instanceof Error ? error.message : "商品の更新に失敗しました"
      );
    }
  };

  const handleImagesChange = useCallback(
    (data: {
      main?: File | string;
      additional?: (File | string)[];
      deleted?: string[];
    }) => {
      setFormData((prev) => {
        if (!prev) return null;

        return {
          ...prev,
          images: {
            ...prev.images,
            ...data,
            keepImageIds: prev.images?.keepImageIds || [],
          },
        };
      });
    },
    []
  );

  // 認証チェックと管理者権限確認
  useEffect(() => {
    if (!authLoading && (!isLoggedIn || currentUser?.role !== "admin")) {
      redirect("/");
    }
  }, [authLoading, isLoggedIn, currentUser]);

  if (authLoading || loading || !formData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        読み込み中...
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto py-12 text-center">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
              商品が見つかりません
            </h2>
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              商品一覧に戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <Link
            href={`/product/${params.id}`}
            className="inline-flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            商品詳細に戻る
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            商品情報の編集
          </h1>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  商品名*
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="category"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  カテゴリー
                </label>
                <input
                  type="text"
                  id="category"
                  name="category"
                  value={formData.category || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="price"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  価格*
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 dark:text-gray-400">¥</span>
                  </div>
                  <input
                    type="number"
                    id="price"
                    name="price"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        price: Number(e.target.value),
                      })
                    }
                    min="0"
                    step="1"
                    required
                    className="block w-full pl-7 pr-12 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="stock"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  在庫数*
                </label>
                <input
                  type="number"
                  id="stock"
                  name="stock"
                  value={formData.stock}
                  onChange={(e) =>
                    setFormData({ ...formData, stock: Number(e.target.value) })
                  }
                  min="0"
                  step="1"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                商品説明*
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                商品画像
              </label>
              <ProductImageUpload
                mainImage={product.images?.main?.url}
                additionalImages={
                  product.images?.additional?.map((img) => img.url) || []
                }
                onImagesChange={handleImagesChange}
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition"
              >
                <CheckIcon className="h-5 w-5 mr-2" />
                更新を保存
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
