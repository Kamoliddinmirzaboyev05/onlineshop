import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    hmr: { host: "localhost", port: 5173 },
  },
  preview: { host: true, port: 5173 },
  build: {
    target: "es2020",
    cssMinify: true,
    rollupOptions: {
      output: {
        // Framer-motion asosiy route'larda kam ishlatiladi — alohida chunk.
        manualChunks: {
          motion: ["framer-motion"],
        },
      },
    },
  },
});
