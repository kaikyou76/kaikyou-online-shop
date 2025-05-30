"use client";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/AuthProvider";
import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardCard from "./components/DashboardCard";

export default function AdminCenter() {
  const router = useRouter();
  const { isLoggedIn, isLoading, currentUser } = useAuth();
  const [authChecked, setAuthChecked] = useState(false);

  console.log("[Debug] Auth State:", {
    isLoggedIn,
    isLoading,
    currentUser,
    role: currentUser?.role,
  });

  useEffect(() => {
    if (!isLoading) {
      setAuthChecked(true);

      if (!isLoggedIn) {
        sessionStorage.setItem("preAuthPath", window.location.pathname);
        router.push("/login");
      } else if (currentUser?.role !== "admin") {
        router.push("/");
      }
    }
  }, [isLoggedIn, isLoading, currentUser, router]);

  if (isLoading || !authChecked) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">管理センター</h1>
        <div className="flex space-x-4">
          <Link
            href="/products/create"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            商品を追加
          </Link>
          <Link
            href="/admin-center/product-list"
            className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-lg transition-colors"
          >
            商品一覧
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">管理者ダッシュボード</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <DashboardCard
            title="登録商品数"
            value="125"
            link="/admin-center/product-list"
          />
          <DashboardCard
            title="新規注文"
            value="8"
            link="/admin-center/orders"
          />
          <DashboardCard
            title="問い合わせ"
            value="3"
            link="/admin-center/inquiries"
          />
        </div>
      </div>
    </div>
  );
}
