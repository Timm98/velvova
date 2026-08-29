import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { getTranslator } from "@paycheck/i18n";
import { createClient } from "./lib/api.ts";
import { useTokens, space } from "./theme.ts";
import { StatusCard } from "./screens/StatusCard.tsx";

/**
 * Die native App.
 *
 * Sie ist bewusst KEINE WebView-Huelle: sie spricht dieselbe API, nutzt
 * dieselben Domaenentypen und Farbtokens, rendert aber mit
 * plattformeigenen Bausteinen.
 *
 * Was hier heute steht, ist der tragfaehige Anfang: Verbindung zur API,
 * ehrliche Zustandsanzeige, sichere Tokenablage, gemeinsame Tokens und
 * Texte. Die Kernabläufe folgen, sobald die nutzerbezogenen Endpunkte
 * stehen - siehe docs/DECISIONS.md.
 */

const client = createClient({
  baseUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:3001",
});

interface Status {
  modus: string;
  ki: { zustand: string; hinweis: string };
  email: { zustand: string; hinweis: string };
}

export default function App() {
  const tokens = useTokens();
  const { t } = getTranslator("de");
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    client
      .integrations()
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          // Ehrlich benennen, statt einen leeren Bildschirm zu zeigen.
          setError(
            e instanceof Error
              ? `${e.message} Läuft die API? "pnpm --filter @paycheck/api dev"`
              : "Unbekannter Fehler.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: tokens.surfacePage },
    scroll: { padding: space[5], gap: space[5] },
    title: { fontSize: 28, fontWeight: "600", color: tokens.textPrimary },
    lead: { fontSize: 16, lineHeight: 24, color: tokens.textSecondary },
    error: {
      color: tokens.critical,
      backgroundColor: tokens.criticalSubtle,
      borderColor: tokens.critical,
      borderWidth: 1,
      borderRadius: 10,
      padding: space[4],
      fontSize: 14,
      lineHeight: 21,
    },
    note: { fontSize: 13, lineHeight: 20, color: tokens.textMuted },
  });

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title} accessibilityRole="header">
          {t("common.appName")}
        </Text>
        <Text style={styles.lead}>{t("landing.subheadline")}</Text>

        {loading && <ActivityIndicator accessibilityLabel={t("common.loading")} />}

        {error && (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        )}

        {status && (
          <View style={{ gap: space[4] }}>
            <StatusCard
              title="Betriebsmodus"
              value={status.modus === "demo" ? "Demo" : "Live"}
              detail={
                status.modus === "demo"
                  ? "Ausschließlich synthetische Daten. Es wird nichts versendet."
                  : "Echte Adapter, soweit konfiguriert."
              }
              tone={status.modus === "demo" ? "caution" : "positive"}
            />
            <StatusCard
              title="KI-Verarbeitung"
              value={status.ki.zustand === "connected" ? "verbunden" : "nicht verbunden"}
              detail={status.ki.hinweis}
              tone={status.ki.zustand === "connected" ? "positive" : "neutral"}
            />
            <StatusCard
              title="E-Mail-Versand"
              value={status.email.zustand === "draft-only" ? "nur Entwürfe" : status.email.zustand}
              detail={status.email.hinweis}
              tone="neutral"
            />
          </View>
        )}

        <Text style={styles.note}>
          Diese App teilt sich Domänentypen, Farbtokens und Texte mit der Weboberfläche. Sie ist
          keine eingebettete Webseite.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
