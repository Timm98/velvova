"use client";

import { useEffect } from "react";
import { useNinaActions, type NinaScopeValue } from "./NinaProvider";

/**
 * Was diese Seite Monday über sich sagt.
 *
 * Eine Seite rendert `<NinaScope jobId={…} />`, und ab dann weiß Monday,
 * worüber gesprochen wird. Beim Verlassen der Seite fällt es weg — der
 * Provider leert den Bereich beim Routenwechsel.
 *
 * Bewusst ein Bauteil und kein Aufruf in einem Effekt der Seite selbst:
 * die meisten Seiten sind Serverkomponenten und können gar keinen
 * Effekt haben. So bleibt genau ein winziges Client-Bauteil übrig,
 * statt eine ganze Seite in den Browser zu verschieben.
 *
 * Die Kennungen sind ein Hinweis, keine Berechtigung. Der Server prüft
 * jede davon gegen die Zeilensicherheit — eine fremde Stellenkennung
 * ergibt dort keinen fremden Datensatz, sondern nichts.
 */
export function NinaScope(scope: NinaScopeValue) {
  const { setScope } = useNinaActions();
  const { jobId, applicationId, documentId } = scope;

  useEffect(() => {
    setScope({ jobId, applicationId, documentId });
  }, [setScope, jobId, applicationId, documentId]);

  return null;
}
