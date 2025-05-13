"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

const NavBar = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const router = useRouter();

  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiUrl) throw new Error("APIエンドポイントが設定されていません");

  // 安全なlocalStorage操作
  const storage = {
    set: (key: string, value: string) => {
      if (typeof window !== "undefined") {
        localStorage.setItem(key, value);
        console.log(`LocalStorageに保存: ${key}`);
      }
    },
    get: (key: string) => {
      if (typeof window !== "undefined") return localStorage.getItem(key);
      return null;
    },
    remove: (key: string) => {
      if (typeof window !== "undefined") localStorage.removeItem(key);
    },
  };

  const clearAuth = () => {
    storage.remove("token");
    storage.remove("user");
    setIsLoggedIn(false);
    setCurrentUser(null);
  };

  const checkAuth = async () => {
    const token = storage.get("token");
    if (!token) {
      clearAuth();
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("認証失敗");

      const userData = await response.json();
      setCurrentUser(userData);
      setIsLoggedIn(true);
    } catch (error) {
      console.error("認証チェックエラー:", error);
      clearAuth();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  if (isLoading) {
    return <div className="animate-pulse h-16 bg-gray-100"></div>;
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
        {isLoggedIn ? (
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
