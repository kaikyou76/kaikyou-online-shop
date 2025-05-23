// frontend/components/NavBar.tsx
"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { AuthButton } from "./AuthButton";
import { LoginLogoutButton } from "./LoginLogoutButton";
import { AuthEditButton } from "./AuthEditButton";

export const NavBar = () => {
  const { isLoggedIn, isLoading, currentUser } = useAuth();

  if (isLoading) {
    return <div className="animate-pulse h-16 bg-gray-100"></div>;
  }

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
            <Link href="/products" className="hover:text-blue-600 font-medium">
              Products
            </Link>
          </li>

          {/* 商品管理ボタン（管理者のみ表示） */}
          {currentUser?.role === "admin" && (
            <li>
              <AuthEditButton
                productId="new"
                className="bg-green-50 hover:bg-green-100"
                productOwnerId={currentUser.id}
              >
                New Product
              </AuthEditButton>
            </li>
          )}

          <div className="flex-grow"></div>

          <AuthButton href="/member-center" className="bg-blue-50">
            会員センター
          </AuthButton>

          {currentUser && (
            <li className="text-sm text-gray-600">
              {currentUser.name} ({currentUser.role})
            </li>
          )}

          <LoginLogoutButton />

          <AuthButton
            href="/register"
            className="bg-gray-100"
            requiredRole={undefined}
          >
            Register
          </AuthButton>

          {/* 管理者のみ表示されるボタン例 */}
          <AuthButton
            href="/admin-center"
            requiredRole="admin"
            className="bg-red-50"
          >
            Admin Panel
          </AuthButton>
        </ul>
      </div>
    </nav>
  );
};
