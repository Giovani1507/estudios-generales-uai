import { config as loadDotenv } from "dotenv";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import type { Plugin } from "vite";

loadDotenv({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".env"),
});

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

// Replit inyecta PORT/BASE_PATH; en local usamos .env o estos defaults.
const rawPort = process.env.PORT ?? "3000";
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";

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
    // En Replit el router une /api con el api-server; en local, proxy a :8080.
    ...(process.env.REPL_ID === undefined
      ? {
          proxy: {
            "/api": {
              target: "http://127.0.0.1:8080",
              changeOrigin: true,
            },
          },
        }
      : {}),
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    ...(process.env.REPL_ID === undefined
      ? {
          proxy: {
            "/api": {
              target: "http://127.0.0.1:8080",
              changeOrigin: true,
            },
          },
        }
      : {}),
  },
});
