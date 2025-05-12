"use client";
import {
  useState,
  useEffect,
  createContext,
  useContext,
  useCallback,
} from "react";
import { usePathname, useRouter } from "next/navigation";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  authState: "loading" | "authenticated" | "unauthenticated";
  currentUser: User | null;
  clearAuth: () => void;
  verifyAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [authState, setAuthState] = useState<
    "loading" | "authenticated" | "unauthenticated"
  >("loading");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiUrl) throw new Error("APIエンドポイントが設定されていません");

  // ストレージ操作（元コード完全再現）
  const storage = {
    get: <T,>(key: string): T | null => {
      if (typeof window === "undefined") return null;
      const item = localStorage.getItem(key);
      if (!item) return null;
      try {
        return JSON.parse(item) as T;
      } catch {
        return item as unknown as T;
      }
    },
    set: (key: string, value: unknown) => {
      if (typeof window === "undefined") return;
      localStorage.setItem(key, JSON.stringify(value));
    },
    remove: (key: string) => {
      if (typeof window === "undefined") return;
      localStorage.removeItem(key);
    },
  };

  // ログアウト処理（元コード完全再現）
  const clearAuth = useCallback(() => {
    storage.remove("token");
    storage.remove("user");
    setAuthState("unauthenticated");
    setCurrentUser(null);
  }, [storage]);

  // 認証検証（元コード完全再現）
  const verifyAuth = useCallback(async () => {
    if (typeof window === "undefined") return;

    const token = storage.get<string>("token");
    if (typeof token !== "string") {
      setAuthState("unauthenticated");
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

      const userData = await response.json();
      storage.set("user", userData);
      setCurrentUser(userData);
      setAuthState("authenticated");
    } catch (error) {
      console.error("認証エラー:", error);
      storage.remove("token");
      setAuthState("unauthenticated");
    }
  }, [apiUrl, storage]);

  // 認証状態チェック（元コード完全再現）
  useEffect(() => {
    verifyAuth();
  }, [verifyAuth]);

  // リダイレクト制御（元コード完全再現）
  useEffect(() => {
    if (typeof window === "undefined") return;
    const publicPaths = ["/", "/login", "/register"];
    if (authState === "unauthenticated" && !publicPaths.includes(pathname)) {
      router.push("/login");
    }
  }, [authState, pathname, router]);

  // ローディング表示（元コード完全再現）
  if (authState === "loading") {
    return <div className="animate-pulse h-16 bg-gray-100" />;
  }

  return (
    <AuthContext.Provider
      value={{ authState, currentUser, clearAuth, verifyAuth }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
