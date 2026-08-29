import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { loadRuntimeConfig } from "@paycheck/config";
import { getDbHandle } from "./client.ts";
import * as s from "./schema/index.ts";

/**
 * Erzeugt eine Anmeldung fuer die Demo-Persona und gibt das Cookie aus.
 *
 * Nur fuer die lokale Entwicklung gedacht - gegen eine Produktionsdatenbank
 * verweigert das Skript den Dienst. Es ersetzt keine Anmeldung im Browser,
 * sondern erspart sie beim Testen und in Rauchtests.
 */

const cfg = loadRuntimeConfig();

if (cfg.nodeEnv === "production" || cfg.db.driver !== "pglite") {
  console.error(
    "Abbruch: dieses Skript legt eine Sitzung ohne Passwortpruefung an und " +
      "ist ausschliesslich fuer die lokale Entwicklung mit PGlite gedacht.",
  );
  process.exit(1);
}

const email = process.argv[2] ?? "lea.demo@example.invalid";
const { db, close } = await getDbHandle(cfg);

const [user] = await db.select().from(s.users).where(eq(s.users.email, email)).limit(1);
if (!user) {
  console.error(`Kein Konto zu "${email}". Zuerst "pnpm db:seed" ausfuehren.`);
  await close();
  process.exit(1);
}

const token = randomBytes(32).toString("base64url");
await db.insert(s.sessions).values({
  userId: user.id,
  tokenHash: createHash("sha256").update(token).digest("hex"),
  deviceLabel: "Lokale Entwicklung",
  expiresAt: new Date(Date.now() + 24 * 3600_000),
});

console.log(`${cfg.auth.cookieName}=${token}`);
await close();
