import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Damit Tests denselben Modulpfad benutzen wie die Anwendung.
      // Ein Test, der über einen anderen Pfad importiert, prüft am Ende
      // eine andere Datei als die, die im Betrieb läuft.
      "@/": `${fileURLToPath(new URL("./apps/web/src", import.meta.url))}/`,
    },
  },
  test: {
    include: ["packages/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts", "tests/unit/**/*.test.ts"],
    exclude: ["**/node_modules/**", "tests/e2e/**"],
    environment: "node",
  },
});
