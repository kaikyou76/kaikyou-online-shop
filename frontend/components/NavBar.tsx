"use client";
import Link from "next/link";
import { useAuth } from "./AuthContext";

const NavBar = () => {
  const { authState, currentUser, clearAuth } = useAuth();

  return (
    <nav className="bg-background text-foreground p-4 shadow-md">
      <ul className="flex space-x-4 items-center">
        <li>
          <Link href="/" className="hover:text-blue-600">
            Home
          </Link>
        </li>
        <li>
          <Link href="/products" className="hover:text-blue-600">
            Products
          </Link>
        </li>
        {authState === "authenticated" ? (
          <>
            {currentUser && (
              <li className="text-sm text-gray-600">
                {currentUser.name} ({currentUser.role})
              </li>
            )}
            <li>
              <button onClick={clearAuth} className="hover:text-blue-600">
                Logout
              </button>
            </li>
          </>
        ) : (
          <>
            <li>
              <Link href="/login" className="hover:text-blue-600">
                Login
              </Link>
            </li>
            <li>
              <Link href="/register" className="hover:text-blue-600">
                Register
              </Link>
            </li>
          </>
        )}
      </ul>
    </nav>
  );
};

export default NavBar;
