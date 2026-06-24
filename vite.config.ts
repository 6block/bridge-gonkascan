import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// cosmjs expects a Node-ish `global`; map it to globalThis for the browser.
export default defineConfig({
  plugins: [react()],
  define: {
    global: "globalThis",
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: { host: true, port: 5174 },
});
