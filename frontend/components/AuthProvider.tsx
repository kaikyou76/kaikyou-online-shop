// /frontend/components/AuthProvider.tsx
"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  isLoggedIn: boolean;
  isLoading: boolean;
  currentUser: User | null;
  clearAuth: () => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiUrl) throw new Error("APIエンドポイントが設定されていません");

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
    if (typeof window === "undefined") return; // SSR中はスキップ
    const token = storage.get("token");
    console.log("🔑 Vercel上のトークン:", token); // これが undefined/null なら100%原因
    if (!token) {
      console.warn("トークンが見つかりません（client）");
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

  return (
    <AuthContext.Provider
      value={{ isLoggedIn, isLoading, currentUser, clearAuth, checkAuth }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
