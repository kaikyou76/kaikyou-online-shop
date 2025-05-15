// frontend/components/NavBar.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

const NavBar = () => {
  const { isLoggedIn, isLoading, currentUser, logout } = useAuth(); // clearAuth → logoutに変更
  const router = useRouter();

  console.log(
    "NavBarレンダリング - isLoggedIn:",
    isLoggedIn,
    "isLoading:",
    isLoading
  );

  const handleLogout = async () => {
    // asyncに変更
    console.log("ログアウト処理開始");
    await logout(); // clearAuth() → await logout()に変更
    console.log("ログアウト処理完了 - ホームにリダイレクト");
    // router.push("/"); ← logout()内で既にリダイレクト処理があるので削除
  };

  if (isLoading) {
    console.log("ローディング中...");
    return <div className="animate-pulse h-16 bg-gray-100"></div>;
  }

  console.log("現在のユーザー:", currentUser);

  return (
    <nav className="bg-background text-foreground p-4 shadow-md">
      <div className="container mx-auto">
        <ul className="flex space-x-6 items-center">
          <li>
            <Link href="/" className="hover:text-blue-600 font-medium">
              Home
            </Link>
          </li>
          <li>
            <Link href="/" className="hover:text-blue-600 font-medium">
              Products
            </Link>
          </li>

          <div className="flex-grow"></div>

          {isLoggedIn ? (
            <>
              <li>
                <Link
                  href="/member-center"
                  className="hover:text-blue-600 font-medium bg-blue-50 px-3 py-1 rounded"
                  onClick={() => console.log("会員センターへ遷移")}
                >
                  会員センター
                </Link>
              </li>
              {currentUser && (
                <li className="text-sm text-gray-600">
                  {currentUser.name} ({currentUser.role})
                </li>
              )}
              <li>
                <button
                  onClick={handleLogout}
                  className="hover:text-blue-600 font-medium"
                >
                  Logout
                </button>
              </li>
            </>
          ) : (
            <>
              <li>
                <Link
                  href="/login"
                  className="hover:text-blue-600 font-medium bg-gray-100 px-3 py-1 rounded"
                  onClick={() => console.log("ログインページへ遷移")}
                >
                  Login
                </Link>
              </li>
              <li>
                <Link
                  href="/register"
                  className="hover:text-blue-600 font-medium bg-gray-100 px-3 py-1 rounded"
                  onClick={() => console.log("登録ページへ遷移")}
                >
                  Register
                </Link>
              </li>
            </>
          )}
        </ul>
      </div>
    </nav>
  );
};

export default NavBar;
