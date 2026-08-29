import { StyleSheet, Text, View } from "react-native";
import { radius, space, useTokens } from "../theme.ts";

/**
 * Eine Zustandskarte. Der Zustand steht als Text, nicht nur als Farbe -
 * dieselbe Regel wie im Web.
 */
export function StatusCard({
  title,
  value,
  detail,
  tone,
}: {
  title: string;
  value: string;
  detail: string;
  tone: "positive" | "caution" | "neutral";
}) {
  const tokens = useTokens();
  const toneColor =
    tone === "positive" ? tokens.positive : tone === "caution" ? tokens.caution : tokens.neutral;
  const toneBackground =
    tone === "positive"
      ? tokens.positiveSubtle
      : tone === "caution"
        ? tokens.cautionSubtle
        : tokens.neutralSubtle;

  const styles = StyleSheet.create({
    card: {
      backgroundColor: tokens.surfaceRaised,
      borderColor: tokens.borderSubtle,
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: space[5],
      gap: space[3],
    },
    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[3] },
    title: { fontSize: 15, fontWeight: "500", color: tokens.textPrimary },
    badge: {
      backgroundColor: toneBackground,
      borderColor: toneColor,
      borderWidth: 1,
      borderRadius: radius.full,
      paddingHorizontal: space[3],
      paddingVertical: 2,
    },
    badgeText: { color: toneColor, fontSize: 13 },
    detail: { fontSize: 14, lineHeight: 21, color: tokens.textSecondary },
  });

  return (
    <View style={styles.card} accessible accessibilityLabel={`${title}: ${value}. ${detail}`}>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{value}</Text>
        </View>
      </View>
      <Text style={styles.detail}>{detail}</Text>
    </View>
  );
}
