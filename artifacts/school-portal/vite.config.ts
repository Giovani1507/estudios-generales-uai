import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import type { Plugin } from "vite";

// Asegura que el HTML nunca se sirva desde caché del navegador,
// para que cada usuario reciba siempre la última versión publicada.
// Los assets con hash en el nombre se siguen cacheando agresivamente.
const noCacheHtmlPlugin = (): Plugin => {
  const apply = (req: any, res: any, next: any) => {
    const url: string = req.url || "";
    const isHtml =
      url === "/" ||
      url.endsWith("/") ||
      url.endsWith(".html") ||
      !/\.[a-zA-Z0-9]+($|\?)/.test(url);
    if (isHtml) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    } else if (/\/assets\/.+\.[a-z0-9]+\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|gif|svg|webp|avif)/i.test(url)) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
    next();
  };
  return {
    name: "no-cache-html",
    configureServer(server) {
      server.middlewares.use(apply);
    },
    configurePreviewServer(server) {
      server.middlewares.use(apply);
    },
  };
};

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    noCacheHtmlPlugin(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
