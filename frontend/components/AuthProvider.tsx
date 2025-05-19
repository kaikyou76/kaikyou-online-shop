// frontend/components/AuthProvider.tsx (統合版)
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
  useRef,
} from "react";
import { useRouter } from "next/navigation";

type Role = "user" | "admin";

interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
}

interface AuthContextType {
  currentUser: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  clearAuth: () => void;
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
  handleLoginSuccess: (token: string, user: User) => Promise<void>;
  updateAuthState: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const router = useRouter();
  const authCheckRef = useRef<Promise<void> | null>(null);
  const initialCheckDone = useRef(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiUrl) throw new Error("APIエンドポイントが設定されていません");

  // 認証状態更新と自動リダイレクト
  const updateAuthState = useCallback(
    (user: User | null) => {
      console.log("[AUTH] 認証状態更新", user);
      setIsLoggedIn(!!user);
      setCurrentUser(user);
      setIsLoading(false);

      if (user && ["/login", "/register"].includes(window.location.pathname)) {
        console.log("[AUTH] 認証済みユーザーをホームにリダイレクト");
        router.push("/");
      }
    },
    [router]
  );

  // 認証情報クリア
  const clearAuth = useCallback(() => {
    console.log("[AUTH] 認証情報をクリア");
    localStorage.removeItem("jwtToken");
    localStorage.removeItem("user");
    updateAuthState(null);
  }, [updateAuthState]);

  // ログイン成功処理
  const handleLoginSuccess = useCallback(
    async (token: string, user: User) => {
      console.log("[AUTH] ログイン成功処理開始");
      localStorage.setItem("jwtToken", token);
      localStorage.setItem("user", JSON.stringify(user));

      try {
        const response = await fetch(`${apiUrl}/api/users/me`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          cache: "no-store",
        });

        if (!response.ok) throw new Error("認証チェックに失敗しました");

        const { data: verifiedUser } = await response.json();
        updateAuthState(verifiedUser);
        console.log("[AUTH] サーバーサイド認証確認済み");
      } catch (error) {
        console.error("認証チェックエラー:", error);
        clearAuth();
        throw error;
      }
    },
    [apiUrl, clearAuth, updateAuthState]
  );

  // 認証チェック
  const checkAuth = useCallback(
    async (initialCheck = false) => {
      if (authCheckRef.current) return authCheckRef.current;

      console.groupCollapsed(
        `[AUTH] 認証チェック開始 (initial: ${initialCheck})`
      );
      setIsLoading(true);

      const authCheckPromise = (async () => {
        try {
          const token = localStorage.getItem("jwtToken");
          const storedUser = localStorage.getItem("user");

          if (!token || !storedUser) {
            console.log("[AUTH] 認証情報なし");
            updateAuthState(null);
            return;
          }

          // トークン検証
          const payload = JSON.parse(atob(token.split(".")[1]));
          if (payload.exp * 1000 < Date.now()) {
            throw new Error("トークンの有効期限切れ");
          }

          // サーバーサイド認証チェック
          const response = await fetch(`${apiUrl}/api/users/me`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            cache: "no-store",
          });

          if (!response.ok) throw new Error(`認証エラー (${response.status})`);

          const { data: userData } = await response.json();
          localStorage.setItem("user", JSON.stringify(userData));
          updateAuthState(userData);

          if (initialCheck && !initialCheckDone.current) {
            initialCheckDone.current = true;
            const currentPath = window.location.pathname;
            if (["/login", "/register"].includes(currentPath)) {
              router.push("/");
            }
          }
        } catch (error) {
          console.error("[AUTH] 認証チェックエラー:", error);
          clearAuth();
          if (initialCheck && !initialCheckDone.current) {
            initialCheckDone.current = true;
            if (!["/login", "/register"].includes(window.location.pathname)) {
              router.push("/login");
            }
          }
        } finally {
          authCheckRef.current = null;
          console.groupEnd();
        }
      })();

      authCheckRef.current = authCheckPromise;
      return authCheckPromise;
    },
    [apiUrl, clearAuth, router, updateAuthState]
  );

  // ログアウト処理
  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("jwtToken");
      if (!token) return clearAuth();

      // トークン検証
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.exp * 1000 >= Date.now()) {
        await fetch(`${apiUrl}/api/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
      }
    } finally {
      clearAuth();
      router.push("/login");
      setIsLoading(false);
    }
  }, [apiUrl, clearAuth, router]);

  // 初回認証チェック
  useEffect(() => {
    const initialCheck = async () => {
      try {
        await checkAuth(true);
      } catch (error) {
        console.error("[AUTH] 初回認証チェックエラー:", error);
      }
    };
    initialCheck();
  }, [checkAuth]);

  // ストレージイベント監視
  useEffect(() => {
    const handleStorageChange = () => checkAuth();
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [checkAuth]);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoggedIn,
        isLoading,
        clearAuth,
        checkAuth,
        logout,
        handleLoginSuccess,
        updateAuthState,
      }}
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
