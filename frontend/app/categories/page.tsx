"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useAuth } from "../../components/AuthProvider";

// カテゴリの型定義
type Category = {
  id: number;
  name: string;
  children: Category[];
};

export default function CategoriesPage() {
  const { isLoggedIn, currentUser, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 認証状態に基づくリダイレクト処理
  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      console.log("[CATEGORIES PAGE] 未認証ユーザーをリダイレクト");
      router.push("/login");
      return;
    }

    // 管理者以外はマイページへリダイレクト
    if (!authLoading && isLoggedIn && currentUser?.role !== "admin") {
      console.log("[CATEGORIES PAGE] 管理者以外をリダイレクト");
      toast.error("管理者のみアクセス可能です");
      router.push("/member-center");
    }
  }, [isLoggedIn, authLoading, router, currentUser]);

  // カテゴリデータ取得
  useEffect(() => {
    if (authLoading || !isLoggedIn || currentUser?.role !== "admin") return;

    const fetchCategories = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const token = localStorage.getItem("jwtToken");
        if (!token) {
          throw new Error("認証トークンがありません");
        }

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/categories`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(
            errorData?.error?.message ||
              `カテゴリの取得に失敗しました (ステータス: ${res.status})`
          );
        }

        const data = await res.json();
        setCategories(data.data || []);
      } catch (error) {
        console.error("カテゴリ取得エラー:", error);
        setError(
          error instanceof Error
            ? error.message
            : "予期せぬエラーが発生しました"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, [authLoading, isLoggedIn, currentUser]);

  // 階層構造のカテゴリをレンダリングする再帰関数
  const renderCategoryTree = (category: Category, depth: number = 0) => {
    const paddingLeft = depth * 32; // 階層の深さに応じてインデント

    return (
      <div key={category.id} className="my-2">
        <div
          className="flex items-center p-3 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow"
          style={{ paddingLeft: `${paddingLeft}px` }}
        >
          <div className="flex-grow">
            <span className="font-medium">{category.name}</span>
            {depth === 0 && (
              <span className="ml-2 text-xs text-blue-500">（大分類）</span>
            )}
          </div>
          <div className="flex space-x-2">
            <Link
              href={`/categories/${category.id}/edit`}
              className="text-sm px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              編集
            </Link>
            <button
              onClick={() => handleDelete(category.id)}
              className="text-sm px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
            >
              削除
            </button>
          </div>
        </div>

        {/* 子カテゴリを再帰的に表示 */}
        {category.children.map((child) => renderCategoryTree(child, depth + 1))}
      </div>
    );
  };

  // カテゴリ削除処理
  const handleDelete = async (categoryId: number) => {
    if (
      !confirm("このカテゴリを削除しますか？関連する商品も影響を受けます。")
    ) {
      return;
    }

    try {
      const token = localStorage.getItem("jwtToken");
      if (!token) {
        throw new Error("認証トークンがありません");
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/categories/${categoryId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(
          errorData?.error?.message ||
            `カテゴリ削除に失敗しました (ステータス: ${res.status})`
        );
      }

      toast.success("カテゴリを削除しました");
      // カテゴリリストを再取得
      setCategories((prev) =>
        prev
          .filter((cat) => cat.id !== categoryId)
          .map((cat) => ({
            ...cat,
            children: cat.children.filter((child) => child.id !== categoryId),
          }))
      );
    } catch (error) {
      console.error("カテゴリ削除エラー:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "カテゴリ削除中にエラーが発生しました"
      );
    }
  };

  // 認証チェック中は何も表示しない
  if (authLoading) {
    return null;
  }

  // 管理者以外は表示しない（リダイレクトされる）
  if (currentUser?.role !== "admin") {
    return null;
  }

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          再読み込み
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">カテゴリ一覧</h1>
        <Link
          href="/categories/create"
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          新しいカテゴリを追加
        </Link>
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">登録されたカテゴリがありません</p>
          <Link
            href="/categories/create"
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            カテゴリを作成
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((category) => renderCategoryTree(category, 0))}
        </div>
      )}
    </div>
  );
}
