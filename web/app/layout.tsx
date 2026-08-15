import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 顶组雷达",
  description:
    "追踪国内外 AI 顶组（工业界 + 学术界）的工作：按作者多源聚合论文，按官方 RSS 收录博客，每日自动刷新。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
