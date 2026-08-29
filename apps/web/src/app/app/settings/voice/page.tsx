import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { updateSettings } from "@/lib/privacy";
import { Card, Field, Select, Separator } from "@/components/ui";
import { NotConnected } from "@/components/ui/states";
import { SaveButton, Toggle } from "../SettingsForm";

export const metadata: Metadata = { title: "Stimme & Gespräch" };
export const dynamic = "force-dynamic";

/**
 * Stimme und Gespräch.
 *
 * Die Voreinstellung „Aufnahme nach dem Abtippen löschen“ ist an. Eine
 * Sprachaufnahme ist ein biometrisches Datum; sie ohne Not aufzubewahren
 * wäre eine Sammlung, für die es keinen Zweck gibt.
 */
export default async function VoiceSettingsPage() {
  const user = await requireUser();
  const { brand, integrations } = await getPageContext();
  const db = await getDb();

  const settings = await withUser(db, user.id, async (tx) =>
    (
      await tx
        .select()
        .from(schema.userSettings)
        .where(eq(schema.userSettings.userId, user.id))
        .limit(1)
    )[0],
  );

  return (
    <form action={updateSettings} className="grid gap-6">
      <Card className="grid gap-5">
        <div>
          <h2 className="text-lg font-semibold">Sprechen statt schreiben</h2>
          <p className="mt-1.5 max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            Im Gespräch mit {brand.assistantName} kannst du jederzeit zwischen Tippen und Sprechen
            wechseln. Das Mikrofon wird erst angefragt, wenn du es benutzt.
          </p>
        </div>

        <Toggle
          name="microphoneEnabled"
          label="Spracheingabe anbieten"
          hint="Zeigt den Mikrofonknopf im Eingabefeld."
          defaultChecked={settings?.microphoneEnabled ?? false}
        />

        <Toggle
          name="voiceCaptions"
          label="Untertitel anzeigen"
          hint="Gesprochenes erscheint zusätzlich als Text. Standardmäßig an."
          defaultChecked={settings?.voiceCaptions ?? true}
        />

        <Toggle
          name="voiceAutoplay"
          label="Antworten automatisch vorlesen"
          hint="Standardmäßig aus — Ton, der ungefragt losgeht, ist selten willkommen."
          defaultChecked={settings?.voiceAutoplay ?? false}
        />

        <Separator soft />

        <Field
          label="Sprechgeschwindigkeit"
          htmlFor="voiceSpeed"
          hint="Gilt für vorgelesene Antworten."
        >
          <Select id="voiceSpeed" name="voiceSpeed" defaultValue={String(settings?.voiceSpeed ?? 1)}>
            <option value="0.75">Langsam</option>
            <option value="1">Normal</option>
            <option value="1.25">Zügig</option>
            <option value="1.5">Schnell</option>
          </Select>
        </Field>
      </Card>

      <Card className="grid gap-5">
        <div>
          <h2 className="text-lg font-semibold">Aufnahmen</h2>
          <p className="mt-1.5 max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            Eine Sprachaufnahme ist ein biometrisches Datum. Sie länger aufzubewahren, als der Zweck
            es verlangt, wäre eine Sammlung ohne Grund.
          </p>
        </div>

        <Toggle
          name="deleteAudioAfterTranscript"
          label="Aufnahme nach dem Abtippen löschen"
          hint="Voreinstellung. Der Text bleibt, die Tonspur nicht."
          defaultChecked={settings?.deleteAudioAfterTranscript ?? true}
        />
      </Card>

      {integrations.voice !== "connected" && (
        <NotConnected
          what="Sprachanbieter"
          detail="Es ist kein Dienst für Spracherkennung oder Sprachausgabe eingerichtet. Der Sprachmodus nutzt, falls vorhanden, die Erkennung deines Browsers — sonst bleibt nur das Tippen."
        />
      )}

      <div>
        <SaveButton />
      </div>
    </form>
  );
}
