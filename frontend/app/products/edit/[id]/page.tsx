// frontend/app/products/edit/[id]/page.tsx
"use client";

import { FormProvider, useForm } from "react-hook-form";
// @ts-ignore
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { redirect, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../../../components/AuthProvider";
import ProductImageUpload from "../../../../components/ProductImageUpload";

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
  const [loading, setLoading] = useState(true);

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
        const productRes = await fetch(`${baseUrl}/api/products/${params.id}`);
        if (!productRes.ok) throw new Error("商品が見つかりません");
        const productData = await productRes.json();

        // カテゴリデータ取得
        // const categoriesRes = await fetch(`${baseUrl}/api/categories`, {
        //   method: "GET",
        //   headers: { Authorization: `Bearer ${token}` },
        // });
        //const categoriesData = await categoriesRes.json();
        // setCategories(categoriesData);
        // keepImageIdsに既存の追加画像IDを設定

        const additionalImageIds =
          productData.data.images.additional?.map(
            (img: ProductImage) => img.id
          ) ?? [];
        reset({
          name: productData.data.name,
          description: productData.data.description || "",
          price: productData.data.price,
          stock: productData.data.stock,
          category_id: productData.data.category_id || null,
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
      } catch (error) {
        console.error("データ取得エラー:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [params.id, reset, authLoading]);

  const onSubmit = async (data: ProductFormValues) => {
    if (!isLoggedIn || currentUser?.role !== "admin") {
      redirect("/");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("name", data.name);
      formData.append("description", data.description || "");
      formData.append("price", data.price.toString());
      formData.append("stock", data.stock.toString());

      if (data.category_id) {
        formData.append("category_id", data.category_id.toString());
      }

      data.images.keepImageIds.forEach((id) => {
        formData.append("keepImageIds", id.toString());
      });

      data.images.deletedImageIds.forEach((id) => {
        formData.append("deleteImageIds", id.toString());
      });

      if (data.images.main && typeof data.images.main !== "string") {
        formData.append("main", data.images.main);
      }

      data.images.additional?.forEach((img) => {
        if (img.url instanceof File) {
          formData.append("additionalImages", img.url);
        }
      });

      const token = localStorage.getItem("jwtToken");
      if (!token) throw new Error("認証トークンがありません");

      const res = await fetch(`${baseUrl}/api/products/edit/${params.id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error("更新に失敗しました");
      router.push(`/products/${params.id}`);
    } catch (error) {
      console.error("更新エラー:", error);
      alert("商品の更新に失敗しました");
    }
  };

  if (authLoading || loading)
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

            {/* カテゴリ */}
            {/* {...register("category_id")} 将来でelectの下に追加*/}
            <div className="space-y-2">
              <label className="block font-medium">カテゴリ</label>
              <select className="w-full p-2 border rounded">
                <option value="">選択してください</option>
                {/*categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))*/}
              </select>
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
        </form>
      </FormProvider>
    </div>
  );
}
