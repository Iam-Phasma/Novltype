import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/Novltype/",
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
        scope: "/Novltype/",
        start_url: "/Novltype/",
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
    outDir: "dist",
    assetsDir: "assets",
  },
});
