"use client";
import { useState } from "react";
import Link from "next/link";

const NavBar = () => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  const handleLoginLogout = () => {
    setIsLoggedIn(!isLoggedIn);
  };

  return (
    <nav className="bg-background text-foreground p-4 shadow-md">
      <ul className="flex space-x-4">
        <li>
          <Link href="/" className="hover:text-blue-600">
            Home
          </Link>
        </li>
        <li>
          <Link href="/" className="hover:text-blue-600">
            Products
          </Link>
        </li>
        {!isLoggedIn && (
          <li>
            <Link href="/register" className="hover:text-blue-600">
              Register
            </Link>
          </li>
        )}
        <li>
          {isLoggedIn ? (
            <button onClick={handleLoginLogout} className="hover:text-blue-600">
              Logout
            </button>
          ) : (
            <Link href="/login">
              <button className="hover:text-blue-600">Login</button>
            </Link>
          )}
        </li>
      </ul>
    </nav>
  );
};

export default NavBar;
