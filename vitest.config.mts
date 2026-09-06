import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Damit Tests denselben Modulpfad benutzen wie die Anwendung.
      // Ein Test, der über einen anderen Pfad importiert, prüft am Ende
      // eine andere Datei als die, die im Betrieb läuft.
      "@/": `${fileURLToPath(new URL("./apps/web/src", import.meta.url))}/`,
      /*
       * `server-only` gibt es im Testlauf nicht.
       *
       * Es ist eine Build-Schranke von Next.js und liegt nicht in
       * `node_modules`. Ohne diesen Ersatz lässt sich kein Modul
       * testen, das die Schranke setzt — und dann wandert die Logik
       * aus solchen Modulen heraus, nur damit sie prüfbar bleibt.
       * Genau das ist beim Mailversand schon einmal passiert.
       */
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["packages/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts", "tests/unit/**/*.test.ts"],
    exclude: ["**/node_modules/**", "tests/e2e/**"],
    environment: "node",
  },
});
