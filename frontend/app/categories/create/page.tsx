// frontend/app/categories/create/page.tsx
"use client";

import { FormProvider, useForm } from "react-hook-form";
// @ts-ignore
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import CategoriesCreate from "../../../components/categories/CategoriesCreate";
import { toast } from "react-toastify";
import { useAuth } from "../../../components/AuthProvider";

const formSchema = z.object({
  name: z
    .string()
    .min(1, "カテゴリ名は必須です")
    .max(100, "カテゴリ名は100文字以内で入力してください"),
  parent_id: z.number().nullable().optional(),
});

export type CategoryFormValues = z.infer<typeof formSchema>;

export default function CategoryCreatePage() {
  const router = useRouter();
  const { currentUser, isLoggedIn, isLoading: authLoading } = useAuth();
  const [categories, setCategories] = useState<
    { id: number; name: string; parent_id: number | null }[]
  >([]);
  const [loading, setLoading] = useState(true);

  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8787";

  const methods = useForm<CategoryFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      parent_id: null,
    },
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  // 既存カテゴリの読み込み（親カテゴリ選択用）
  useEffect(() => {
    if (authLoading) return;

    const fetchCategories = async () => {
      try {
        const res = await fetch(`${baseUrl}/api/categories`);
        if (!res.ok) throw new Error("カテゴリの読み込みに失敗しました");
        const data = await res.json();
        setCategories(data.data || []);
      } catch (error) {
        console.error("カテゴリ取得エラー:", error);
        toast.error("カテゴリデータの読み込みに失敗しました");
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, [authLoading, baseUrl]);

  const onSubmit = async (data: CategoryFormValues) => {
    if (!isLoggedIn || currentUser?.role !== "admin") {
      toast.error("管理者権限が必要です");
      return;
    }

    try {
      const token = localStorage.getItem("jwtToken");
      if (!token) {
        toast.error("認証トークンがありません");
        return;
      }

      const res = await fetch(`${baseUrl}/api/categories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      const responseData = await res.json();

      if (!res.ok) {
        if (res.status === 400 || res.status === 409) {
          toast.error(
            responseData.error?.message || "入力内容に誤りがあります"
          );
        } else {
          throw new Error(
            responseData.error?.message || "カテゴリの作成に失敗しました"
          );
        }
        return;
      }

      toast.success("カテゴリを作成しました");
      router.push("/categories");
    } catch (error) {
      console.error("カテゴリ作成エラー:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "カテゴリの作成中に予期せぬエラーが発生しました"
      );
    }
  };

  if (authLoading || loading)
    return <div className="text-center py-8">読み込み中...</div>;
  if (!isLoggedIn)
    return <div className="text-center py-8">ログインが必要です</div>;
  if (currentUser?.role !== "admin")
    return <div className="text-center py-8">管理者権限が必要です</div>;

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">カテゴリ登録</h1>
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <CategoriesCreate categories={categories} />
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
              {isSubmitting ? "作成中..." : "登録"}
            </button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}
