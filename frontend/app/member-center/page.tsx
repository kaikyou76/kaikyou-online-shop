// frontend/app/member-center/page.tsx
"use client";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/AuthProvider";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function MemberCenter() {
  const router = useRouter();
  const { isLoggedIn, isLoading, currentUser } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      sessionStorage.setItem("preAuthPath", "/member-center");
      router.push("/login");
    } else if (isLoggedIn && currentUser) {
      setIsAdmin(currentUser.role === "admin");
    }
  }, [isLoggedIn, isLoading, currentUser, router]);

  if (isLoading || !isLoggedIn) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">ユーザーダッシュボード</h1>
      <p className="mb-6">
        ようこそ！ここでは注文履歴やアカウント情報を確認できます。
      </p>

      {/* 管理者向けのカテゴリ管理リンクを追加 */}
      {isAdmin && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">管理者メニュー</h2>
          <div className="flex space-x-4">
            <Link href="/categories/create" passHref>
              <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                カテゴリ管理
              </button>
            </Link>
            <Link href="/products/create" passHref>
              <button className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
                商品登録
              </button>
            </Link>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            <p>※ カテゴリ管理では商品の分類体系を管理できます</p>
          </div>
        </div>
      )}
    </div>
  );
}
