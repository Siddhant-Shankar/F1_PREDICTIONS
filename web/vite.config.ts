import { defineConfig } from "vite";

// GitHub Pages serves the site from /<repo>/, so assets need that prefix.
export default defineConfig({
  base: process.env.PAGES_BASE ?? "/",
  build: { outDir: "dist", chunkSizeWarningLimit: 800 },
});
