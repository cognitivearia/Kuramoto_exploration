import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  // En GitHub Pages el sitio vive en /Kuramoto_exploration/.
  // En local, npm run dev sigue abriendo la raíz.
  base: command === "build" ? "/Kuramoto_exploration/" : "/",
  server: { host: "0.0.0.0", port: 5173 },
  preview: { host: "0.0.0.0", port: 5173 },
}));
