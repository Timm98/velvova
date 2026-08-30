"use client";

import { usePathname } from "next/navigation";
import { NinaDrawer } from "./NinaDrawer";

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

  /*
   * Nur der Drawer, kein schwebender Knopf mehr.
   *
   * Nina steht seit dem Umbau als Pille im Header — auf jeder Seite,
   * mit Namen. Ein zweiter Knopf unten rechts wäre derselbe Weg noch
   * einmal, und er sähe aus wie ein Support-Widget. Auf schmalen
   * Geräten führt der Bereich „Nina" in der unteren Leiste zur
   * Vollbildseite.
   */
  return <NinaDrawer assistantName={assistantName} />;
}
