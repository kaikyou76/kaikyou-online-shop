// frontend/app/product/edit/[id]/page.tsx
"use client";

import { ArrowLeftIcon, CheckIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { redirect, useRouter } from "next/navigation";
import { ProductImageUpload } from "../../../../components/ProductImageUpload";
import { useAuth } from "../../../../components/AuthProvider";
import { useEffect, useCallback, useState, useMemo } from "react";
import { useForm } from "react-hook-form";

// 型定義
type ImageObject = {
  id: string | number;
  url: string;
  is_main?: boolean;
};

type ProductImages = {
  main?: ImageObject;
  additional?: ImageObject[];
};

type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  category?: string;
  images?: ProductImages;
  createdAt: string;
};

type ProductFormData = {
  name: string;
  description: string;
  price: number;
  stock: number;
  category?: string;
  images?: {
    main?: File | string | ImageObject;
    additional?: (File | string | ImageObject)[];
    deleted?: string[];
    keepImageIds?: (string | number)[];
  };
};

const deepEqual = (a: any, b: any): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

export default function ProductEditPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const { currentUser, isLoggedIn, isLoading: authLoading } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8787";

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormData>();

  // 商品データ取得
  const fetchProduct = useCallback(async () => {
    try {
      const res = await fetch(`${baseUrl}/api/products/${params.id}`);
      if (!res.ok) throw new Error("商品が見つかりません");
      const data: Product = await res.json();

      setProduct(data);
      reset({
        name: data.name,
        description: data.description,
        price: data.price,
        stock: data.stock,
        category: data.category,
        images: {
          main: data.images?.main || "",
          additional: data.images?.additional || [],
          deleted: [],
          keepImageIds: [
            data.images?.main?.id,
            ...(data.images?.additional?.map((img) => img.id) || []),
          ].filter(Boolean),
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "商品の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [params.id, baseUrl, reset]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  // 画像変更ハンドラ
  const handleImagesChange = useCallback(
    (data: {
      main?: File | string | ImageObject;
      additional?: (File | string | ImageObject)[];
      deleted?: string[];
    }) => {
      const current = getValues("images") || {};
      const newValue = {
        ...current,
        ...data,
        keepImageIds: current.keepImageIds || [],
      };

      // 変更がある場合のみ更新
      if (!deepEqual(current, newValue)) {
        setValue("images", newValue);
      }
    },
    [getValues, setValue]
  );

  // 商品更新処理
  const updateProduct = useCallback(
    async (data: ProductFormData) => {
      const token = localStorage.getItem("jwtToken");
      if (!token) throw new Error("認証トークンがありません");

      const formData = new FormData();
      formData.append("name", data.name);
      formData.append("description", data.description);
      formData.append("price", data.price.toString());
      formData.append("stock", data.stock.toString());

      if (data.category) {
        formData.append("category_id", data.category);
      }

      // 画像処理
      if (data.images) {
        // メイン画像処理
        if (data.images.main) {
          if (data.images.main instanceof File) {
            formData.append("mainImage", data.images.main);
          } else if (typeof data.images.main === "object") {
            formData.append("mainImageId", data.images.main.id.toString());
          }
        }

        // 追加画像処理
        data.images.additional?.forEach((item) => {
          if (item instanceof File) {
            formData.append("additionalImages", item);
          } else if (typeof item === "object") {
            formData.append("additionalImageIds", item.id.toString());
          }
        });

        if (data.images.keepImageIds) {
          formData.append(
            "keepImageIds",
            JSON.stringify(data.images.keepImageIds)
          );
        }

        if (data.images.deleted?.length) {
          formData.append("deletedImages", JSON.stringify(data.images.deleted));
        }
      }

      const res = await fetch(`${baseUrl}/api/products/${params.id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "商品の更新に失敗しました");
      }

      return await res.json();
    },
    [baseUrl, params.id]
  );

  // フォーム送信処理
  const onSubmit = useMemo(
    () =>
      handleSubmit(async (data) => {
        try {
          setError(null);
          await updateProduct(data);
          router.push(`/product/${params.id}`);
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "更新に失敗しました");
        }
      }),
    [handleSubmit, updateProduct, router, params.id]
  );

  // 認証チェック
  useEffect(() => {
    if (!authLoading && (!isLoggedIn || currentUser?.role !== "admin")) {
      redirect("/");
    }
  }, [authLoading, isLoggedIn, currentUser]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto py-12 text-center">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
              {error || "商品が見つかりません"}
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
          {error && (
            <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-md dark:bg-red-900 dark:text-red-100">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  商品名*
                </label>
                <input
                  {...register("name", { required: "商品名は必須です" })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
                {errors.name && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.name.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  カテゴリー
                </label>
                <input
                  {...register("category")}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                商品説明
              </label>
              <textarea
                {...register("description")}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  価格 (円)*
                </label>
                <input
                  type="number"
                  {...register("price", {
                    required: "価格は必須です",
                    valueAsNumber: true,
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
                {errors.price && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.price.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  在庫数*
                </label>
                <input
                  type="number"
                  {...register("stock", {
                    required: "在庫数は必須です",
                    valueAsNumber: true,
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
                {errors.stock && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.stock.message}
                  </p>
                )}
              </div>
            </div>
            <ProductImageUpload
              value={{
                main: getValues("images")?.main,
                additional: getValues("images")?.additional,
                deleted: getValues("images")?.deleted,
              }}
              onChange={handleImagesChange}
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <CheckIcon className="h-5 w-5 mr-2" />
              {isSubmitting ? "保存中..." : "保存する"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
