// frontend/components/AuthManager.tsx
"use client";
import { useEffect } from "react";
import { useAuth } from "./AuthProvider";

export const AuthManager = () => {
  const { currentUser, logout } = useAuth();

  useEffect(() => {
    const validateToken = async () => {
      if (!currentUser) return;

      const token = localStorage.getItem("jwtToken");
      if (!token) {
        logout();
        return;
      }

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";

        const res = await fetch(`${apiUrl}/api/validate`, {
          method: "POST", // 明示的にPOSTを指定
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}), // 空のボディ
        });

        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      } catch (error) {
        console.error("Token validation failed:", error);
        logout();
      }
    };

    validateToken();
    const timer = setInterval(validateToken, 300000);
    return () => clearInterval(timer);
  }, [currentUser, logout]);

  return null;
};
