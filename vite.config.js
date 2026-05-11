import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/Novltype/",
  plugins: [tailwindcss()],
  build: {
    outDir: "dist",
    assetsDir: "assets",
  },
});
