// frontend/components/AuthButton.tsx
"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { ReactNode } from "react";

interface AuthButtonProps {
  children: ReactNode;
  requiredRole?: "user" | "admin";
  className?: string;
  href?: string;
  onClick?: () => void;
}

export const AuthButton = ({
  children,
  requiredRole,
  className = "",
  href,
  onClick,
}: AuthButtonProps) => {
  const { isLoggedIn, currentUser, isLoading } = useAuth();

  if (isLoading) return null;

  // ログイン不要またはログイン済みで権限条件を満たす場合
  const isVisible =
    !requiredRole || (isLoggedIn && currentUser?.role === requiredRole);

  if (!isVisible) return null;

  const baseClasses = "hover:text-blue-600 font-medium px-3 py-1 rounded";
  const finalClasses = `${baseClasses} ${className}`;

  return href ? (
    <Link href={href} className={finalClasses} onClick={onClick}>
      {children}
    </Link>
  ) : (
    <button className={finalClasses} onClick={onClick}>
      {children}
    </button>
  );
};
