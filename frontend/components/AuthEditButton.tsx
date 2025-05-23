// frontend/components/AuthEditButton.tsx
"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { ReactNode, useEffect } from "react";
import { PencilIcon } from "@heroicons/react/24/outline";

interface AuthEditButtonProps {
  children?: ReactNode;
  productOwnerId: string | number; // requiredに変更
  productId: string;
  className?: string;
  debug?: boolean; // デバッグモード用
}

export const AuthEditButton = ({
  children,
  productOwnerId,
  productId,
  className = "",
  debug = process.env.NODE_ENV === "development",
}: AuthEditButtonProps) => {
  const { isLoggedIn, currentUser, isLoading } = useAuth();

  // デバッグ用エフェクト
  useEffect(() => {
    if (debug) {
      console.debug("[AuthEditButton Debug]", {
        isLoggedIn,
        isLoading,
        currentUser,
        productOwnerId,
        typeMatching: {
          userIdType: typeof currentUser?.id,
          ownerIdType: typeof productOwnerId,
        },
        permissionCheck: {
          isAdmin: currentUser?.role === "admin",
          isOwner: String(currentUser?.id) === String(productOwnerId),
        },
      });
    }
  }, [debug, isLoggedIn, isLoading, currentUser, productOwnerId]);

  if (isLoading) {
    if (debug) console.debug("[AuthEditButton] Loading state");
    return null;
  }

  // 型安全な比較 (数値/文字列どちらでも対応)
  const isOwner = String(currentUser?.id) === String(productOwnerId);
  const isAdmin = currentUser?.role === "admin";
  const isVisible = isLoggedIn && (isAdmin || isOwner);

  if (!isVisible) {
    if (debug) console.debug("[AuthEditButton] Hidden - No permission");
    return null;
  }

  // スタイリング
  const baseClasses =
    "inline-flex items-center gap-1.5 text-sm hover:text-blue-600 font-medium px-3 py-1.5 rounded-md transition-colors";
  const finalClasses = `${baseClasses} ${className}`.trim();

  return (
    <Link
      href={`/product/${productId}/edit`}
      className={finalClasses}
      aria-label="Edit product"
      prefetch={false}
    >
      <PencilIcon className="h-4 w-4 flex-shrink-0" />
      {children || "Edit"}
    </Link>
  );
};
