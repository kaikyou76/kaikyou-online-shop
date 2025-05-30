// frontend/app/member-center/page.tsx
"use client";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/AuthProvider";
import { useEffect } from "react";

export default function MemberCenter() {
  const router = useRouter();
  const { isLoggedIn, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      sessionStorage.setItem("preAuthPath", "/member-center");
      router.push("/login");
    }
  }, [isLoggedIn, isLoading, router]);

  if (isLoading || !isLoggedIn) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">ユーザーダッシュボード</h1>
      <p>ようこそ！ここでは注文履歴やアカウント情報を確認できます。</p>
    </div>
  );
}
