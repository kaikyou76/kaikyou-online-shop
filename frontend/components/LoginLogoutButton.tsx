// components/LoginLogoutButton.tsx
"use client";

import { AuthButton } from "./AuthButton";
import { useAuth } from "./AuthProvider";

export const LoginLogoutButton = () => {
  const { isLoggedIn, logout, isLoading } = useAuth();

  if (isLoading) return null;

  return isLoggedIn ? (
    <button
      onClick={logout}
      className="hover:text-blue-600 font-medium px-3 py-1 rounded"
    >
      Logout
    </button>
  ) : (
    <AuthButton href="/login" className="bg-gray-100">
      Login
    </AuthButton>
  );
};
