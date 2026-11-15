import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// el build queda en ../web y lo sirve fastapi; en desarrollo se usa el proxy
export default defineConfig({
  plugins: [react()],
  build: { outDir: "../web", emptyOutDir: true },
  server: {
    port: 5190,
    proxy: {
      "/api": "http://localhost:8790",
      "/ws": { target: "ws://localhost:8790", ws: true },
    },
  },
});
