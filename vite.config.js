import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "./",
  plugins: [tailwindcss()],
  server: {
    proxy: {
      "/api": {
        target: process.env.FLIXORA_API_TARGET || "http://127.0.0.1:3201",
        changeOrigin: false,
      },
    },
  },
  build: {
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
