import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "moodboard",
  base: "./",
  plugins: [react()],
  build: {
    outDir: "../renderer/board",
    emptyOutDir: true
  }
});
