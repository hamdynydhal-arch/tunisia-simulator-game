import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: `next build` emits a plain HTML/JS site into ./out,
  // deployable to any static host (GitHub Pages, Vercel, etc.).
  output: "export",

  images: { unoptimized: true },

  // GitHub Pages redirects /sakan → /sakan/ then serves sakan/index.html.
  // trailingSlash:true makes Next.js emit sakan/index.html instead of sakan.html.
  trailingSlash: true,

  // GitHub Pages serves project sites under /<repo>; CI sets NEXT_BASE_PATH
  // so asset URLs resolve correctly.  Local dev leaves it empty.
  basePath: process.env.NEXT_BASE_PATH ?? "",

  // The repository root contains another project's lockfile; pin the app root
  // so Turbopack doesn't infer the wrong workspace directory.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
