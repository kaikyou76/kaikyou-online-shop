// frontend/hooks/useRedirectIfNotLoggedIn.ts
"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "../components/AuthProvider";

export const useRedirectIfNotLoggedIn = () => {
  const { isLoggedIn, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      console.log(
        "ユーザーがログインしていません。ログインページにリダイレクトします。"
      );
      router.push("/login");
    }
  }, [isLoggedIn, isLoading, router]);
};
