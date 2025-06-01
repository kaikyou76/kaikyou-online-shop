"use client";

import { FormProvider, useForm } from "react-hook-form";
// @ts-ignore
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { redirect, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../../../components/AuthProvider";
import ProductImageUpload from "../../../../components/ProductImageUpload";

type Category = {
  id: number;
  name: string;
};

type ProductImage = {
  id: number;
  url: string;
  is_main: boolean;
};

type ProductData = {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  category_id: number | null;
  images: {
    main: ProductImage | null;
    additional: ProductImage[];
  };
};

const formSchema = z.object({
  name: z.string().min(1, "商品名は必須です"),
  description: z.string().optional(),
  price: z.number().min(0, "価格は0以上で入力してください"),
  stock: z.number().min(0, "在庫数は0以上で入力してください"),
  category_id: z.number().nullable().optional(),
  images: z.object({
    main: z
      .union([z.instanceof(File), z.string()])
      .optional()
      .nullable(),
    additional: z
      .array(
        z.object({
          url: z.union([z.string(), z.instanceof(File)]),
          is_main: z.boolean(),
        })
      )
      .optional(),
    keepImageIds: z.array(z.number()).default([]),
    deletedImageIds: z.array(z.number()).default([]),
  }),
});

export type ProductFormValues = z.infer<typeof formSchema>;

export default function ProductEditPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const { currentUser, isLoggedIn, isLoading: authLoading } = useAuth();
  const [initialData, setInitialData] = useState<{ data: ProductData } | null>(
    null
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [formInitialized, setFormInitialized] = useState(false); // フォーム初期化状態を追跡
  const [isDeleting, setIsDeleting] = useState(false); // 削除処理中の状態

  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8787";
  const traceId = useRef<string>(
    Math.random().toString(36).substring(2, 11)
  ).current;

  const methods = useForm<ProductFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      stock: 0,
      category_id: null,
      images: {
        main: null,
        additional: [],
        keepImageIds: [],
        deletedImageIds: [],
      },
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    watch,
  } = methods;

  useEffect(() => {
    if (authLoading) return;

    const fetchData = async () => {
      try {
        const token = localStorage.getItem("jwtToken");
        if (!token) {
          throw new Error("認証トークンがありません");
        }

        // 商品データとカテゴリデータを並行して取得
        const [productRes, categoriesRes] = await Promise.all([
          fetch(`${baseUrl}/api/products/${params.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${baseUrl}/api/categories`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!productRes.ok) throw new Error("商品が見つかりません");
        const productData = await productRes.json();

        if (!categoriesRes.ok) {
          console.error("カテゴリ取得エラー:", categoriesRes.status);
          setCategories([]);
        } else {
          const categoriesData = await categoriesRes.json();
          setCategories(categoriesData.data || []);
        }

        const additionalImageIds =
          productData.data.images.additional?.map(
            (img: ProductImage) => img.id
          ) ?? [];

        // カテゴリIDを数値として取得（APIからnullまたは数値が返る）
        const categoryId = productData.data.category_id
          ? Number(productData.data.category_id)
          : null;

        // フォームのリセット（商品データ取得後に実行）
        reset({
          name: productData.data.name,
          description: productData.data.description || "",
          price: productData.data.price,
          stock: productData.data.stock,
          category_id: categoryId, // 数値型でセット
          images: {
            main: productData.data.images.main?.url || undefined,
            additional:
              productData.data.images.additional.map((img: ProductImage) => ({
                url: img.url,
                is_main: false,
              })) ?? [],
            keepImageIds: [
              productData.data.images.main?.id,
              ...additionalImageIds,
            ].filter((id): id is number => !!id),
            deletedImageIds: [],
          },
        });

        setInitialData(productData);
        setFormInitialized(true); // フォーム初期化完了
      } catch (error) {
        console.error("データ取得エラー:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [params.id, reset, authLoading]);

  const handleDelete = async () => {
    if (
      !confirm("この商品を削除しますか？関連する画像ファイルも削除されます。")
    ) {
      return;
    }

    if (!isLoggedIn || currentUser?.role !== "admin") {
      return;
    }

    setIsDeleting(true);
    try {
      const token = localStorage.getItem("jwtToken");
      if (!token) {
        throw new Error("認証トークンがありません");
      }

      const res = await fetch(`${baseUrl}/api/products/${params.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error?.message || "削除に失敗しました");
      }

      alert("商品を削除しました");
      router.push("/products"); // 商品一覧ページへリダイレクト
    } catch (error) {
      console.error("削除エラー:", error);
      let errorMessage = "商品の削除に失敗しました";
      if (error instanceof Error) {
        errorMessage += `: ${error.message}`;
      }
      alert(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const onSubmit = async (data: ProductFormValues) => {
    if (!isLoggedIn || currentUser?.role !== "admin") {
      redirect("/");
      return;
    }

    try {
      // メイン画像の必須チェック
      if (data.images.main === null || data.images.main === undefined) {
        alert("メイン画像を選択してください");
        return;
      }

      const formData = new FormData();
      formData.append("name", data.name);
      formData.append("description", data.description || "");
      formData.append("price", data.price.toString());
      formData.append("stock", data.stock.toString());

      // カテゴリIDを確実に送信 (nullでも送信)
      if (data.category_id !== null && data.category_id !== undefined) {
        formData.append("category_id", data.category_id.toString());
      } else {
        formData.append("category_id", ""); // 空文字を送信
      }

      data.images.keepImageIds.forEach((id) => {
        formData.append("keepImageIds", id.toString());
      });

      data.images.deletedImageIds.forEach((id) => {
        formData.append("deleteImageIds", id.toString());
      });

      // メイン画像処理
      if (typeof data.images.main === "string") {
        formData.append("mainImage", data.images.main);
      } else {
        formData.append("mainImage", data.images.main);
      }

      data.images.additional?.forEach((img) => {
        if (img.url instanceof File) {
          formData.append("additionalImages", img.url);
        }
      });

      const token = localStorage.getItem("jwtToken");
      if (!token) {
        throw new Error("認証トークンがありません");
      }

      // デバッグ用ログ: 送信されるカテゴリIDを確認
      console.log(`[${traceId}] 🌟 送信カテゴリID:`, data.category_id);
      console.log(`[${traceId}] 🌟 送信FormData内容:`);
      for (const [key, value] of formData.entries()) {
        console.log(key, value);
      }

      const res = await fetch(`${baseUrl}/api/products/edit/${params.id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        console.error(`[${traceId}] ❌ APIエラー応答:`, errorData);
        throw new Error(errorData.error?.message || "更新に失敗しました");
      }

      const result = await res.json();
      console.log(`[${traceId}] ✅ 商品更新成功:`, result);
      router.push(`/products/${params.id}`);
    } catch (error) {
      console.error(`[${traceId}] ❌ 更新エラー:`, error);

      let errorMessage = "商品の更新に失敗しました";
      if (error instanceof Error) {
        errorMessage += `: ${error.message}`;
      } else if (typeof error === "string") {
        errorMessage += `: ${error}`;
      }

      alert(errorMessage);
    }
  };

  // 現在のカテゴリIDを取得（デバッグ用）
  const currentCategoryId = watch("category_id");
  useEffect(() => {
    console.log(`[${traceId}] 🚦 現在のカテゴリID:`, currentCategoryId);
  }, [currentCategoryId, traceId]);

  if (authLoading || loading || !formInitialized)
    return <div className="text-center py-8">読み込み中...</div>;
  if (!isLoggedIn)
    return <div className="text-center py-8">ログインが必要です</div>;
  if (currentUser?.role !== "admin")
    return <div className="text-center py-8">管理者権限が必要です</div>;
  if (!initialData)
    return <div className="text-center py-8">商品が見つかりません</div>;

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">商品編集</h1>
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block font-medium">商品名</label>
              <input
                {...register("name")}
                type="text"
                className="w-full p-2 border rounded"
              />
              {errors.name && (
                <p className="text-red-500 text-sm">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block font-medium">価格</label>
              <input
                {...register("price", { valueAsNumber: true })}
                type="number"
                min="0"
                className="w-full p-2 border rounded"
              />
              {errors.price && (
                <p className="text-red-500 text-sm">{errors.price.message}</p>
              )}
            </div>

            {/* カテゴリ - 修正箇所 */}
            <div className="space-y-2">
              <label className="block font-medium">カテゴリ</label>
              <select
                {...register("category_id", {
                  setValueAs: (value) => (value === "" ? null : Number(value)),
                })}
                className="w-full p-2 border rounded"
              >
                <option value="">選択なし</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {errors.category_id && (
                <p className="text-red-500 text-sm">
                  {errors.category_id.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block font-medium">在庫数</label>
              <input
                {...register("stock", { valueAsNumber: true })}
                type="number"
                min="0"
                className="w-full p-2 border rounded"
              />
              {errors.stock && (
                <p className="text-red-500 text-sm">{errors.stock.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block font-medium">商品説明</label>
            <textarea
              {...register("description")}
              rows={5}
              className="w-full p-2 border rounded"
            />
            {errors.description && (
              <p className="text-red-500 text-sm">
                {errors.description.message}
              </p>
            )}
          </div>

          <ProductImageUpload
            mainImage={
              watch("images.main") && typeof watch("images.main") === "string"
                ? {
                    id: initialData.data.images.main?.id || -1,
                    url: watch("images.main") as string,
                    is_main: true,
                  }
                : undefined
            }
            additionalImages={
              initialData.data.images.additional?.map((img) => ({
                id: img.id,
                url: img.url,
                is_main: img.is_main,
              })) || []
            }
            onMainImageChange={(file) => setValue("images.main", file)}
            onAdditionalImageChange={(files) => {
              setValue("images.additional", [
                ...(watch("images.additional") || []),
                ...files,
              ]);
            }}
            onDeleteMainImage={(id) => {
              if (id) {
                const currentIds = watch("images.deletedImageIds") || [];
                if (!currentIds.includes(id)) {
                  setValue("images.deletedImageIds", [...currentIds, id]);
                }
              }
              setValue("images.main", null);
            }}
            onDeleteAdditionalImage={(index, id) => {
              if (id) {
                const currentIds = watch("images.deletedImageIds") || [];
                if (!currentIds.includes(id)) {
                  setValue("images.deletedImageIds", [...currentIds, id]);
                }
              }
              setValue(
                "images.additional",
                (watch("images.additional") || []).filter((_, i) => i !== index)
              );
            }}
          />

          <div className="flex justify-end space-x-4 pt-4">
            <div>
              {/* 削除ボタン（左側に配置） */}
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting || isDeleting}
                className="px-4 py-2 bg-red-500 text-white rounded disabled:bg-red-300"
              >
                {isDeleting ? "削除中..." : "商品を削除"}
              </button>
            </div>
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-4 py-2 border rounded"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-blue-300"
              >
                {isSubmitting ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}
