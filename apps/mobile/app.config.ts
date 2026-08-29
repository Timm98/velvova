import type { ExpoConfig } from "expo/config";

/**
 * Der Anwendungsname kommt aus derselben zentralen Konfiguration wie im
 * Web. Eine Umbenennung soll auch auf dem Homescreen ankommen.
 *
 * @paycheck/config wird hier bewusst NICHT importiert: die Datei laeuft
 * im Node-Kontext des Expo-Werkzeugs, und die Laufzeitkonfiguration
 * gehoert nicht in ein Build-Artefakt. Der Name kommt aus der Umgebung
 * mit demselben Standard.
 */
const brandName = process.env.NEXT_PUBLIC_BRAND_NAME ?? "Paycheck";

const config: ExpoConfig = {
  name: brandName,
  slug: "paycheck",
  version: "0.1.0",
  orientation: "portrait",
  scheme: "paycheck",
  userInterfaceStyle: "automatic",
  // Die neue Architektur ist in Expo 57 Standard und braucht keinen Schalter.

  ios: {
    supportsTablet: true,
    bundleIdentifier: "invalid.paycheck.app",
    infoPlist: {
      // Der Text erscheint in der Systemabfrage. Er nennt den Zweck und
      // die Grenze - Sprache wird zu Text, mehr nicht.
      NSMicrophoneUsageDescription:
        "Damit du mit der Karriereassistenz sprechen kannst statt zu tippen. " +
        "Aus deiner Stimme wird ausschliesslich Text; es findet keine Auswertung " +
        "von Betonung, Akzent oder Stimmung statt.",
    },
  },

  android: {
    package: "invalid.paycheck.app",
    permissions: ["RECORD_AUDIO"],
  },

  plugins: ["expo-secure-store"],

  extra: {
    apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3001",
  },
};

export default config;
