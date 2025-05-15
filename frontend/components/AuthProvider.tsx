// frontend/components/AuthProvider.tsx
"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useRef,
} from "react";
import { useRouter } from "next/navigation";

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
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const router = useRouter();
  const authCheckRef = useRef<Promise<void> | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiUrl) throw new Error("APIエンドポイントが設定されていません");

  const clearAuth = useCallback(() => {
    console.log("認証情報をクリア");
    localStorage.removeItem("jwtToken");
    localStorage.removeItem("user");
    setIsLoggedIn(false);
    setCurrentUser(null);
  }, []);

  const checkAuth = useCallback(
    async (initialCheck = false) => {
      if (authCheckRef.current) {
        return authCheckRef.current;
      }

      console.log("認証チェック開始", { initialCheck });
      setIsLoading(true);

      const authCheckPromise = (async () => {
        try {
          const token = localStorage.getItem("jwtToken");
          const storedUser = localStorage.getItem("user");

          if (!token || !storedUser) {
            throw new Error("認証情報がありません");
          }

          // トークンの有効期限チェック
          const payload = JSON.parse(atob(token.split(".")[1]));
          if (payload.exp * 1000 < Date.now()) {
            throw new Error("トークンの有効期限が切れています");
          }

          // 即時UI更新のためにローカルデータを使用
          const user = JSON.parse(storedUser);
          setCurrentUser(user);
          setIsLoggedIn(true);

          // サーバーサイド認証チェック
          const response = await fetch(`${apiUrl}/api/users/me`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            credentials: "include",
            cache: "no-store",
          });

          if (!response.ok) {
            throw new Error("認証が必要です");
          }

          const userData = await response.json();
          localStorage.setItem("user", JSON.stringify(userData));
          setCurrentUser(userData);
          setIsLoggedIn(true); // 明示的に状態を更新

          // 初期チェック時のみリダイレクト処理
          if (initialCheck) {
            const currentPath = window.location.pathname;
            if (currentPath === "/login" || currentPath === "/register") {
              router.push("/");
            }
          }
        } catch (error) {
          console.error("認証チェックエラー:", error);
          clearAuth();
          if (initialCheck && window.location.pathname !== "/login") {
            router.push("/login");
          }
        } finally {
          setIsLoading(false);
          authCheckRef.current = null;
        }
      })();

      authCheckRef.current = authCheckPromise;
      return authCheckPromise;
    },
    [apiUrl, clearAuth, router]
  );

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("jwtToken");

      if (!token) {
        console.warn(
          "ログアウト: トークンが存在しないためローカルクリアのみ実行"
        );
        clearAuth();
        router.push("/login");
        return;
      }

      // トークンの基本検証
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload.exp * 1000 < Date.now()) {
          console.warn("ログアウト: トークン有効期限切れ");
          clearAuth();
          router.push("/login");
          return;
        }
      } catch (e) {
        console.error("トークン解析エラー:", e);
        clearAuth();
        router.push("/login");
        return;
      }

      const response = await fetch(`${apiUrl}/api/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      // 401エラーでもクリア処理は実行
      if (response.status === 401) {
        console.warn("サーバー側で認証無効と判定");
      } else if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("ログアウト失敗詳細:", {
          status: response.status,
          error: errorData,
        });
        throw new Error(`ログアウトに失敗しました: ${response.status}`);
      }

      console.log("ログアウト成功");
      clearAuth();
      router.push("/login");
    } catch (error) {
      console.error("ログアウト処理中に例外発生:", error);
      clearAuth();
      router.push("/login");
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, clearAuth, router]);

  useEffect(() => {
    // 初回のみ実行
    let mounted = true;
    const initialCheck = async () => {
      await checkAuth(true);
    };

    if (mounted) {
      initialCheck();
    }

    return () => {
      mounted = false;
    };
  }, [checkAuth]);

  useEffect(() => {
    // localStorageの変更を監視
    const handleStorageChange = () => {
      checkAuth();
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [checkAuth]);

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        isLoading,
        currentUser,
        clearAuth,
        checkAuth,
        logout,
      }}
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
