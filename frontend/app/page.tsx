// frontend/app/page.tsx
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "../components/AuthProvider";
import { useRouter } from "next/navigation";

type Product = {
  id: number;
  name: string;
  price: number;
  stock: number;
};

export default function Home() {
  const { isLoggedIn, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 認証状態に基づくリダイレクト処理
  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      console.log("[PAGE] 未認証ユーザーをリダイレクト");
      router.push("/login");
    }
  }, [isLoggedIn, authLoading, router]);

  // 商品データ取得
  useEffect(() => {
    if (authLoading || !isLoggedIn) return;

    const fetchProducts = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/products`,
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (!res.ok) {
          throw new Error(
            `商品の取得に失敗しました (ステータス: ${res.status})`
          );
        }

        const data = await res.json();
        setProducts(data);
      } catch (error) {
        console.error("商品取得エラー:", error);
        setError(
          error instanceof Error
            ? error.message
            : "予期せぬエラーが発生しました"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [authLoading, isLoggedIn]);

  // 認証チェック中は何も表示しない
  if (authLoading) {
    return null;
  }

  // 未認証状態であればここまで来ない（リダイレクトされる）
  if (!isLoggedIn) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-lg"></div>
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
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-center">🛒 商品一覧</h1>

      {products.length === 0 ? (
        <p className="text-center text-gray-500">商品が見つかりませんでした</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/products/${product.id}`}
              className="block p-6 border border-gray-200 rounded-lg shadow hover:shadow-md transition"
            >
              <h2 className="text-xl font-semibold mb-2 truncate">
                {product.name}
              </h2>
              <div className="flex justify-between items-center">
                <p className="text-gray-600">
                  ¥{product.price.toLocaleString()}
                </p>
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    product.stock > 0
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {product.stock > 0 ? "在庫あり" : "売り切れ"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
