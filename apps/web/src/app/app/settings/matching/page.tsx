import type { Metadata } from "next";
import { ladeBedingungen } from "@/lib/nina/bedingungen-aktionen";
import { AbgleichForm } from "./AbgleichForm";

export const metadata: Metadata = { title: "Abgleich & Bedingungen" };
export const dynamic = "force-dynamic";

export default async function Seite() {
  const c = await ladeBedingungen();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Abgleich & Bedingungen</h1>
        <p className="mt-2 max-w-prose leading-relaxed text-ink-2">
          Eine harte Bedingung schliesst Stellen aus. Häufiger als der klare Fall ist aber der
          offene: die Anzeige sagt zu deiner Bedingung schlicht nichts. Hier legst du fest, was dann
          geschieht — und siehst, welche Bedingungen gerade gelten.
        </p>
      </div>
      <AbgleichForm start={c} />
    </div>
  );
}
