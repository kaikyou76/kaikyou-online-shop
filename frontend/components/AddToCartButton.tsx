"use client";

import { ShoppingCartIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AddToCartButton({
  productId,
  disabled,
  isAuthenticated,
}: {
  productId: number;
  disabled: boolean;
  isAuthenticated: boolean;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=/product/${productId}`);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/cart`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ productId }),
        }
      );

      if (!res.ok) {
        throw new Error(await res.text());
      }

      // 成功時の処理（Toast通知など）
      alert("カートに追加しました");
    } catch (error) {
      console.error("カート追加エラー:", error);
      alert("カート追加に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleAddToCart}
      disabled={disabled || isLoading}
      className={`w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white ${
        !disabled
          ? "bg-indigo-600 hover:bg-indigo-700"
          : "bg-gray-400 cursor-not-allowed"
      } md:py-4 md:text-lg md:px-10 transition`}
    >
      <ShoppingCartIcon className="h-6 w-6 mr-2" />
      {isLoading
        ? "処理中..."
        : disabled
        ? "売り切れ"
        : isAuthenticated
        ? "カートに追加"
        : "ログインして購入"}
    </button>
  );
}
