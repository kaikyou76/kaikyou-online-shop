import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}", // プロジェクトのファイルパスを指定
    "./components/**/*.{js,ts,jsx,tsx}",
    // 他のファイルパスがあれば追加
  ],
  darkMode: "media", // ここに追加
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        sans: ["Arial", "Helvetica", "sans-serif"], // デフォルトの sans-serif フォント
        mono: ["monospace"], // デフォルトの monospace フォント
      },
    },
  },
  plugins: [],
};

export default config;
