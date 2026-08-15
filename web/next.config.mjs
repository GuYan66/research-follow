/** @type {import('next').NextConfig} */
// 项目站部署在 https://<user>.github.io/<repo>/ 时需 basePath=/repo。
// 用环境变量 NEXT_PUBLIC_BASE_PATH 配置，默认 ""（本地 dev 与用户根域名站）。
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
  // 静态导出，部署到 GitHub Pages（无服务端运行时）
  output: "export",
  // Pages 友好：目录式 URL，且无需服务端重写
  trailingSlash: true,
  // 静态站无法用 next/image 优化器
  images: { unoptimized: true },
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
};

export default nextConfig;
