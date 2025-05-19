// // frontend/components/AddToAdminButton.tsx
// "use client";

// import { useRouter } from "next/navigation";
// import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
// import { useAuth } from "./AuthProvider";
// import { useEffect, useState } from "react";

// export default function AddToAdminButton() {
//   const router = useRouter();
//   const { currentUser, isLoading, checkAuth } = useAuth();
//   const [isAdmin, setIsAdmin] = useState(false);

//   useEffect(() => {
//     // 認証状態を再確認
//     checkAuth().then(() => {
//       console.log("Current user after check:", currentUser); // デバッグ用
//     });
//   }, [checkAuth]);

//   useEffect(() => {
//     if (currentUser) {
//       console.log("Checking admin role for:", currentUser.role); // デバッグ用
//       setIsAdmin(currentUser.role === "admin");
//     }
//   }, [currentUser]);

//   if (isLoading || !isAdmin) {
//     return null;
//   }

//   return (
//     <button
//       onClick={() => router.push("/admin-center")}
//       className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
//       aria-label="管理者センターへ移動"
//     >
//       <ArrowTopRightOnSquareIcon className="h-4 w-4" />
//       管理者センター
//     </button>
//   );
// }
