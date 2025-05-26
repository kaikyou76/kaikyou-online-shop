// frontend/app/product/edit/[id]/page.tsx
"use client";

import { ArrowLeftIcon, CheckIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { redirect, useRouter } from "next/navigation";
import { ProductImageUpload } from "../../../../components/ProductImageUpload";
import { useAuth } from "../../../../components/AuthProvider";
import { useState, useEffect, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
// @ts-ignore
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

type ImageObject = {
  id: number;
  url: string;
  is_main?: boolean;
};

type ProductImages = {
  main?: ImageObject;
  additional?: ImageObject[];
};

// 新しいImageState型を追加（既存のformSchemaと連携）
type ImageFormState = {
  main?: File | string;
  additional?: Array<File | string>;
  deletedImageIds: number[];
  keepImageIds: number[];
  existingIds: number[]; // 追加
};

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  images?: ProductImages;
  category?: string;
  createdAt: string;
}

const formSchema = z.object({
  name: z.string().min(1, "商品名は必須です"),
  description: z.string().min(1, "商品説明は必須です"),
  price: z.number().min(0, "価格は0以上で入力してください"),
  stock: z.number().min(0, "在庫数は0以上で入力してください"),
  category: z.string().optional(),
  images: z
    .object({
      main: z.union([z.instanceof(File), z.string()]).optional(),
      additional: z.array(z.union([z.instanceof(File), z.string()])).optional(),
      deletedImageIds: z.array(z.number()).default([]),
      keepImageIds: z.array(z.number()).default([]),
      existingIds: z.array(z.number()).default([]), // 追加
    })
    .optional(),
});

type ProductFormData = z.infer<typeof formSchema>;

export default function ProductEditPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const { currentUser, isLoggedIn, isLoading: authLoading } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8787";

  // 🌟 デバッグ用トレースID生成
  const generateTraceId = () => Math.random().toString(36).substring(2, 11);
  const traceId = useRef<string>(generateTraceId()).current;

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormData>({
    resolver: zodResolver(formSchema),
  });

  // 商品データ取得（デバッグログ追加）
  const fetchProduct = useCallback(async () => {
    console.log(`[${traceId}] 🌟 商品取得開始`, new Date().toISOString());
    try {
      const res = await fetch(`${baseUrl}/api/products/${params.id}`, {
        headers: { Accept: "application/json" },
      });
      console.log(`[${traceId}] 🌟 商品取得レスポンス:`, res.status);

      if (!res.ok) throw new Error("商品が見つかりません");
      const data: Product = await res.json();

      // 🌟 取得した画像情報のログ
      console.log(`[${traceId}] 🌟 取得画像データ:`, {
        mainId: data.images?.main?.id,
        additionalIds: data.images?.additional?.map((img) => img.id),
        keepImageIds: [
          data.images?.main?.id,
          ...(data.images?.additional?.map((img) => img.id) || []),
        ].filter(Boolean),
      });

      setProduct(data);

      const collectExistingIds = () => {
        return [
          data.images?.main?.id,
          ...(data.images?.additional?.map((img) => img.id) || []),
        ].filter((id): id is number => typeof id === "number");
      };
      const existingIds = collectExistingIds(); // 実行
      reset({
        name: data.name,
        description: data.description,
        price: data.price,
        stock: data.stock,
        category: data.category,
        images: {
          main: data.images?.main?.url || "", // 空文字で統一
          additional: data.images?.additional?.map((img) => img.url) || [], // 空配列で統一
          deletedImageIds: [], // 初期値は空配列
          keepImageIds: [...existingIds], // 初期値は全既存ID
          existingIds: [...existingIds], // 既存IDを保持
        },
      });
    } catch (err) {
      console.error(`[${traceId}] 🌟 商品取得エラー:`, err);
      setError(err instanceof Error ? err.message : "商品の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [params.id, baseUrl, reset]);

  useEffect(() => {
    console.log(`[${traceId}] 🌟 商品データ取得Effect開始`);
    fetchProduct();
    return () => {
      console.log(`[${traceId}] 🌟 商品データ取得Effectクリーンアップ`);
    };
  }, [fetchProduct]);

  // 画像変更ハンドラ（デバッグログ追加）
  const handleImagesChange = useCallback(
    (data: {
      main?: { id: number; file?: File; url: string };
      additional?: { id: number; file?: File; url: string }[];
      deletedImageIds?: number[]; // プロパティ名を子コンポーネントと一致させる
      keepImageIds?: number[];
    }) => {
      console.log(`[${traceId}] 🌟 画像変更検出:`, {
        mainType: data.main?.file ? "File" : data.main?.url ? "URL" : "None",
        additionalCount: data.additional?.length,
        deleted: data.deletedImageIds, //
        keepImageIds: data.keepImageIds,
      });

      const currentImages =
        getValues("images") ||
        ({
          deletedImageIds: [],
          keepImageIds: [],
          existingIds: [],
          main: undefined,
          additional: [],
        } as {
          deletedImageIds: number[];
          keepImageIds: number[];
          existingIds: number[];
          main?: string | File;
          additional?: (string | File)[];
        });

      const newValue = {
        ...currentImages,
        main: data.main ? data.main.file || data.main.url : undefined,
        additional: data.additional?.map((item) => item.file || item.url) || [],
        deletedImageIds: data.deletedImageIds || [], // プロパティ名を修正
        keepImageIds: data.keepImageIds || [],
        existingIds: currentImages.existingIds || [], //
      };

      console.log(`[${traceId}] 🌟 画像状態更新:`, {
        before: currentImages,
        after: newValue,
      });

      setValue("images", newValue, { shouldDirty: true });
    },
    [getValues, setValue]
  );

  // 商品更新処理（詳細ログ追加）
  const updateProduct = useCallback(
    async (data: ProductFormData) => {
      console.log(`[${traceId}] 🌟 更新処理開始`, new Date().toISOString());
      try {
        const token = localStorage.getItem("jwtToken");
        if (!token) throw new Error("認証トークンがありません");

        // 送信データの検証ログ
        console.log(`[${traceId}] 🌟 検証済みフォームデータ:`, {
          name: data.name,
          price: data.price,
          images: {
            mainType: data.images?.main?.constructor.name,
            additionalCount: data.images?.additional?.length,
            keepImageIds: data.images?.keepImageIds,
            deletedCount: data.images?.deletedImageIds?.length,
          },
        });

        const formData = new FormData();
        formData.append("name", data.name);
        formData.append("description", data.description);
        formData.append("price", data.price.toString());
        formData.append("stock", data.stock.toString());

        if (data.category) {
          formData.append("category_id", data.category);
        }

        // 画像処理ロジック
        if (data.images) {
          // 1. 既存画像IDの収集（変更なし）
          const existingMainId = product?.images?.main?.id;
          const existingAdditionalIds =
            product?.images?.additional?.map((img) => img.id) || [];
          const allExistingIds = [
            ...(existingMainId ? [existingMainId] : []),
            ...existingAdditionalIds,
          ].filter((id): id is number => !!id);

          // 2. 削除対象IDの決定（新しいロジック）
          const explicitlyDeletedIds = data.images.deletedImageIds || []; // 明示的に削除指定されたID
          const userKeepIds =
            data.images.keepImageIds?.filter((id): id is number => !!id) || [];

          // 削除対象 = (既存IDでユーザーが保持を選択していないもの) OR (明示的に削除指定されたもの)
          const deletedIds = Array.from(
            new Set([
              ...allExistingIds.filter((id) => !userKeepIds.includes(id)),
              ...explicitlyDeletedIds,
            ])
          );

          // 3. 保持IDの決定（既存IDから削除対象を除外）
          const keepIds = allExistingIds.filter(
            (id) => !deletedIds.includes(id)
          );

          // 4. FormDataへの追加
          deletedIds.forEach((id) => formData.append("deleted", id.toString()));
          keepIds.forEach((id) =>
            formData.append("keepImageIds", id.toString())
          );

          // 5. メイン画像処理（変更なし）
          if (data.images.main instanceof File) {
            formData.append("mainImage", data.images.main);
          } else if (typeof data.images.main === "string") {
            formData.append("mainImage", data.images.main);
          }

          // 6. 追加画像処理（型安全な処理を維持）
          data.images.additional?.forEach((item) => {
            if (item instanceof File) {
              formData.append("additionalImages", item);
            } else if (typeof item === "string") {
              formData.append("additionalImageUrls", item);
            } else if (
              typeof item === "object" &&
              item !== null &&
              "url" in item
            ) {
              const urlValue = (item as { url: unknown }).url;
              if (typeof urlValue === "string") {
                formData.append("additionalImageUrls", urlValue);
              } else {
                console.error(`無効なURL形式: ${urlValue}`);
              }
            } else {
              console.error("予期せぬデータ形式:", item);
            }
          });

          // デバッグ用ログ
          console.log("画像処理結果:", {
            existingIds: allExistingIds,
            explicitlyDeleted: explicitlyDeletedIds,
            userKeepIds,
            finalDeleted: deletedIds,
            finalKeep: keepIds,
          });
        }

        // ログ用データ生成
        const logData = {
          keepImageIds: formData.getAll("keepImageIds"),
          deletedImages: formData.getAll("deleted"),
          mainImage:
            data.images?.main instanceof File
              ? data.images.main.name
              : data.images?.main,
          additionalImages: data.images?.additional?.map((img) => {
            if (img instanceof File) return img.name;
            if (typeof img === "string") return img;
            if (typeof img === "object" && img !== null && "url" in img) {
              return (img as { url: string }).url;
            }
            return "不明な形式";
          }),
        };
        console.log(`[${traceId}] 🌟 送信データ詳細:`, logData);

        const res = await fetch(`${baseUrl}/api/products/${params.id}`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        console.log(`[${traceId}] 🌟 APIレスポンス:`, {
          status: res.status,
          ok: res.ok,
        });

        if (!res.ok) {
          const error = await res.json();
          console.error(`[${traceId}] 🌟 エラー詳細:`, error);
          throw new Error(error.message || "更新に失敗しました");
        }

        return await res.json();
      } finally {
        console.log(`[${traceId}] 🌟 更新処理終了`, new Date().toISOString());
      }
    },
    [baseUrl, params.id, product]
  );

  // フォーム送信ハンドラ（エラートラッキング強化）
  const onSubmit = handleSubmit(async (data) => {
    try {
      console.log(`[${traceId}] 🌟 フォーム送信開始`, new Date().toISOString());
      await updateProduct(data);
      router.push(`/product/${params.id}`);
    } catch (err) {
      console.error(`[${traceId}] 🌟 フォーム送信エラー:`, err);
      setError(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      console.log(`[${traceId}] 🌟 フォーム送信終了`, new Date().toISOString());
    }
  });

  // 認証チェック
  useEffect(() => {
    console.log(`[${traceId}] 🌟 認証チェック開始`);
    if (!authLoading && (!isLoggedIn || currentUser?.role !== "admin")) {
      console.log(`[${traceId}] 🌟 認証失敗 - リダイレクト`);
      redirect("/");
    }
    return () => {
      console.log(`[${traceId}] 🌟 認証チェックEffectクリーンアップ`);
    };
  }, [authLoading, isLoggedIn, currentUser]);

  if (authLoading || loading) {
    console.log(`[${traceId}] 🌟 ローディング状態表示`);
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!product) {
    console.log(`[${traceId}] 🌟 商品データなし状態表示`);
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

  console.log(`[${traceId}] 🌟 レンダリング開始`);
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
                  {...register("name")}
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
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  価格*
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 dark:text-gray-400">¥</span>
                  </div>
                  <input
                    type="number"
                    {...register("price", { valueAsNumber: true })}
                    min="0"
                    step="1"
                    className="block w-full pl-7 pr-12 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
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
                  {...register("stock", { valueAsNumber: true })}
                  min="0"
                  step="1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
                {errors.stock && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.stock.message}
                  </p>
                )}
              </div>{" "}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                商品説明*
              </label>
              <textarea
                {...register("description")}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
              {errors.description && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.description.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                商品画像
              </label>
              <ProductImageUpload
                mainImage={
                  watch("images.main")
                    ? {
                        id: product?.images?.main?.id || -1, // 実際のDB IDを使用
                        url: watch("images.main") as string,
                      }
                    : undefined
                }
                additionalImages={
                  watch("images.additional")
                    ? (product?.images?.additional || []).map((img) => ({
                        id: img.id, // 実際のDB IDを使用
                        url: img.url,
                      }))
                    : undefined
                }
                onImagesChange={handleImagesChange}
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition"
              >
                <CheckIcon className="h-5 w-5 mr-2" />
                {isSubmitting ? "保存中..." : "更新を保存"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
