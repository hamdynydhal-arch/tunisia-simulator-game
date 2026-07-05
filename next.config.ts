import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: `next build` emits a plain HTML/JS site into ./out,
  // deployable to any static host (GitHub Pages, etc.).
  output: "export",
  images: { unoptimized: true },
  // GitHub Pages serves project sites under /<repo>; CI sets this so asset
  // URLs resolve there while local dev keeps serving from the root.
  basePath: process.env.NEXT_BASE_PATH ?? "",
  // The repository root contains another project's lockfile; pin the app root
  // so Turbopack doesn't infer the wrong workspace directory.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
