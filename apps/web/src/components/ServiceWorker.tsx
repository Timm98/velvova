"use client";

import { useEffect } from "react";

/**
 * Registriert die Offline-Hülle. Nur in Produktion - in der Entwicklung
 * würde ein Service Worker die Aktualisierung verlangsamen und beim
 * Debuggen in die Quere kommen.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Fehlschlag ist kein Problem: die Anwendung funktioniert online
      // vollständig. Der Worker bringt nur die Offline-Hülle.
    });
  }, []);
  return null;
}
