// frontend/app/admin-center/page.tsx
"use client";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/AuthProvider";
import { useEffect } from "react";

export default function AdminCenter() {
  const router = useRouter();
  const { isLoggedIn, isLoading } = useAuth();
  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      sessionStorage.setItem("preAuthPath", window.location.pathname);
      router.push("/login");
    }
  }, [isLoggedIn, isLoading, router]);
  if (isLoading || !isLoggedIn) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">管理員センター</h1>
      <p>ようこそ！管理員様。</p>
    </div>
  );
}
