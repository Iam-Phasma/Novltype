import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

const basePath = process.env.BASE_PATH || "/";
const normalizedBasePath = basePath.endsWith("/") ? basePath : `${basePath}/`;

export default defineConfig({
  base: normalizedBasePath,
  plugins: [
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/pwa-192x192.png", "icons/pwa-512x512.png"],
      manifest: {
        name: "Novltype",
        short_name: "Novltype",
        description: "Minimal typing trainer with keyboard sound and focus-first UI",
        theme_color: "#111111",
        background_color: "#111111",
        display: "standalone",
        scope: normalizedBasePath,
        start_url: normalizedBasePath,
        icons: [
          {
            src: "icons/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,mp3,wav}"],
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        insights: fileURLToPath(new URL("./insights.html", import.meta.url)),
      },
    },
    outDir: "dist",
    assetsDir: "assets",
  },
});
