"use client";

import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui";
import { useNinaActions } from "./NinaProvider";

/**
 * Ein Knopf irgendwo auf der Seite, der zu Monday führt.
 *
 * Er öffnet die Blase unten rechts und lässt sie kurz blinken. Das
 * Blinken ist nicht Zierde: Ein Knopf in der Mitte der Seite öffnet
 * etwas am unteren Rand, und ohne Hinweis sucht man es.
 *
 * Bewusst als eigener Baustein, damit derselbe Weg an jeder Stelle
 * gleich aussieht und gleich funktioniert — und damit es nicht auf
 * jeder Seite eine eigene Fassung davon gibt.
 */
export function NinaFragenKnopf({ assistantName }: { assistantName: string }) {
  const nina = useNinaActions();

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={() => nina.pulsAnstossen()}
    >
      <MessageSquare className="size-4" strokeWidth={1.9} />
      {assistantName} fragen
    </Button>
  );
}
