import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    // Docker Desktop bind mounts (esp. on Windows) don't reliably deliver native
    // filesystem change events into the container, so chokidar's default watcher
    // silently misses edits. USE_POLLING is set in docker-compose.yml's web service.
    watch: process.env.USE_POLLING
      ? { usePolling: true, interval: 300 }
      : undefined,
    proxy: {
      "/api": {
        // Inside Docker, "localhost" is the web container itself — the api
        // service is only reachable as "api" on the compose network. Set via
        // docker-compose.yml's web service; falls back to localhost for native dev.
        target: process.env.API_PROXY_TARGET ?? "http://localhost:3000",
        changeOrigin: true,
        // The API serves everything under its own /api/v1 global prefix
        // (apps/api/src/main.ts), so the path is passed through as-is — no
        // stripping/rewriting. Mirrors docker/nginx/templates/default.conf.template.
      },
    },
  },
});
