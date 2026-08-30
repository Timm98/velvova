"use client";

import { usePathname } from "next/navigation";
import { NinaDrawer, NinaLauncher } from "./NinaDrawer";

/**
 * Knopf und Gesprächsfläche zusammen.
 *
 * Die eine Ausnahme: auf der Vollbildseite des Gesprächs erscheint
 * beides nicht. Nina zweimal gleichzeitig auf demselben Bildschirm wäre
 * kein Angebot, sondern eine Verdopplung — und die schwebende Fläche
 * würde ausgerechnet den Composer verdecken, den sie ersetzen soll.
 */
export function NinaDock({ assistantName }: { assistantName: string }) {
  const pathname = usePathname();
  if (pathname.startsWith("/app/nina")) return null;

  return (
    <>
      <NinaLauncher assistantName={assistantName} />
      <NinaDrawer assistantName={assistantName} />
    </>
  );
}
