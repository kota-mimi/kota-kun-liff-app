import type { Metadata } from "next";
import "./globals.css";

// ★★★ Vercelの特殊なフォントを使うのを、やめました！ ★★★
// import { Inter } from "next/font/google";
// const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Personal Coach", // ページタイトルを変更
  description: "Your personal AI coach on LINE",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      {/* ★★★ bodyのクラス名から、フォント指定を削除！ ★★★ */}
      <body>{children}</body>
    </html>
  );
}