import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { updateSettings } from "@/lib/privacy";
import { Card } from "@/components/ui";
import { NotConnected } from "@/components/ui/states";
import { SaveButton, Toggle } from "../SettingsForm";

export const metadata: Metadata = { title: "Benachrichtigungen" };
export const dynamic = "force-dynamic";

/**
 * Benachrichtigungen.
 *
 * Was hier bewusst fehlt: tägliche Erinnerungen, Serien, Punktestände.
 * Wer Arbeit sucht, steht ohnehin unter Druck. Eine Benachrichtigung
 * muss einen Anlass haben, nicht einen Zeitplan.
 */
export default async function NotificationSettingsPage() {
  const user = await requireUser();
  const { integrations } = await getPageContext();
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
          <h2 className="text-lg font-semibold">Wann wir uns melden</h2>
          <p className="mt-1.5 max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            Nur bei einem echten Anlass: eine Frist rückt näher, eine Rückmeldung ist eingegangen,
            ein Termin steht an. Keine täglichen Erinnerungen, keine Serien, keine Punktestände.
          </p>
        </div>

        <Toggle
          name="notificationEmail"
          label="E-Mail"
          hint="Fristen, Termine und Rückmeldungen zu deinen Bewerbungen."
          defaultChecked={settings?.notificationEmail ?? true}
        />

        <Toggle
          name="notificationPush"
          label="Push auf dieses Gerät"
          hint="Erfordert die installierte Web-App und deine ausdrückliche Erlaubnis im Browser."
          defaultChecked={settings?.notificationPush ?? false}
        />
      </Card>

      {integrations.mail === "draft-only" && (
        <NotConnected
          what="E-Mail-Versand"
          detail="Es ist kein Postfach verbunden. Erinnerungen erscheinen deshalb nur in der Anwendung, und Bewerbungen entstehen als Entwurf zum Herunterladen — nie als automatischer Versand."
        />
      )}

      <div>
        <SaveButton />
      </div>
    </form>
  );
}
