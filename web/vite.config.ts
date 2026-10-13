import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// GitHub Pages serves the site from /<repo>/, so assets need that prefix.
// Two pages: the landing page at the root and the replay app at /replay/.
export default defineConfig({
  base: process.env.PAGES_BASE ?? "/",
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      input: {
        home: fileURLToPath(new URL("index.html", import.meta.url)),
        replay: fileURLToPath(new URL("replay/index.html", import.meta.url)),
      },
    },
  },
});
