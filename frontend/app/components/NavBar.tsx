"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

const NavBar = () => {
  const [authState, setAuthState] = useState<
    "loading" | "authenticated" | "unauthenticated"
  >("loading");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiUrl) throw new Error("APIエンドポイントが設定されていません");

  // 安全なストレージ操作 (TypeScript型付き)
  const storage = {
    get: <T,>(key: string): T | null => {
      if (typeof window === "undefined") return null;
      const item = localStorage.getItem(key);
      if (!item) return null;
      // JSONとして解析可能かチェック
      try {
        return JSON.parse(item) as T;
      } catch (e) {
        // JSONではない場合は生の文字列として返す
        return item as unknown as T;
      }
    },
    set: (key: string, value: unknown) => {
      if (typeof window === "undefined") return;
      // 文字列でもオブジェクトでも統一してJSON保存
      localStorage.setItem(key, JSON.stringify(value));
    },
    remove: (key: string) => {
      if (typeof window === "undefined") return;
      localStorage.removeItem(key);
    },
  };

  const clearAuth = useCallback(() => {
    storage.remove("token");
    storage.remove("user");
    setAuthState("unauthenticated");
    setCurrentUser(null);
  }, [storage]);

  const verifyAuth = useCallback(async () => {
    if (typeof window === "undefined") return;

    // トークン取得（JSON解析失敗時は生の文字列として扱う）
    const token = storage.get<string>("token");
    if (typeof token !== "string") {
      setAuthState("unauthenticated");
      return;
    }

    try {
      // 認証APIリクエスト
      const response = await fetch(`${apiUrl}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

      // ユーザーデータ処理
      const userData = await response.json();
      storage.set("user", userData);
      setCurrentUser(userData);
      setAuthState("authenticated");
    } catch (error) {
      console.error("認証エラー:", error);
      storage.remove("token"); // 不正なトークンを削除
      setAuthState("unauthenticated");
    }
  }, [apiUrl, storage]);

  // 認証状態チェック
  useEffect(() => {
    verifyAuth();
  }, [verifyAuth]);

  // 認証状態に基づくリダイレクト制御
  useEffect(() => {
    if (typeof window === "undefined") return;
    const publicPaths = ["/", "/login", "/register"];
    if (authState === "unauthenticated" && !publicPaths.includes(pathname)) {
      router.push("/login");
    }
  }, [authState, pathname, router]);

  if (authState === "loading") {
    return <div className="animate-pulse h-16 bg-gray-100" />;
  }

  return (
    <nav className="bg-background text-foreground p-4 shadow-md">
      <ul className="flex space-x-4 items-center">
        <li>
          <Link href="/" className="hover:text-blue-600">
            Home
          </Link>
        </li>
        <li>
          <Link href="/products" className="hover:text-blue-600">
            Products
          </Link>
        </li>
        {authState === "authenticated" ? (
          <>
            {currentUser && (
              <li className="text-sm text-gray-600">
                {currentUser.name} ({currentUser.role})
              </li>
            )}
            <li>
              <button onClick={clearAuth} className="hover:text-blue-600">
                Logout
              </button>
            </li>
          </>
        ) : (
          <>
            <li>
              <Link href="/login" className="hover:text-blue-600">
                Login
              </Link>
            </li>
            <li>
              <Link href="/register" className="hover:text-blue-600">
                Register
              </Link>
            </li>
          </>
        )}
      </ul>
    </nav>
  );
};

export default NavBar;
