import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Upload } from "lucide-react";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { Badge, Button, Card } from "@/components/ui";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { Ablagefeld } from "./Ablagefeld";

export const metadata: Metadata = { title: "Dokumente" };
export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  cv: "Lebenslauf",
  cv_ats: "Lebenslauf (ATS)",
  cover_letter: "Anschreiben",
  application_email: "Bewerbungs-E-Mail",
  certificate: "Zeugnis",
  reference: "Referenz",
  other: "Sonstiges",
};

/**
 * Dokumente.
 *
 * Alles an einem Ort: hochgeladene Unterlagen und erzeugte Fassungen.
 * Die Trennung verläuft nicht nach Dateityp, sondern nach Herkunft —
 * was du mitgebracht hast, und was aus deinem Profil entstanden ist.
 */
export default async function DocumentsPage() {
  const user = await requireUser();
  const { integrations } = await getPageContext();
  const db = await getDb();

  const [uploaded, generated, abgelegt] = await Promise.all([
    withUser(db, user.id, (tx) =>
      tx
        .select()
        .from(schema.documents)
        .where(eq(schema.documents.userId, user.id))
        .orderBy(desc(schema.documents.createdAt)),
    ),
    withUser(db, user.id, (tx) =>
      tx
        .select({
          id: schema.generatedArtifacts.id,
          kind: schema.generatedArtifacts.kind,
          version: schema.generatedArtifacts.version,
          createdAt: schema.generatedArtifacts.createdAt,
          approvedByUser: schema.generatedArtifacts.approvedByUser,
          applicationId: schema.generatedArtifacts.applicationId,
        })
        .from(schema.generatedArtifacts)
        .where(eq(schema.generatedArtifacts.userId, user.id))
        .orderBy(desc(schema.generatedArtifacts.createdAt))
        .limit(30),
    ),
    /*
     * Die zweite Tabelle.
     *
     * `documents` trägt, was über die Bewerbungswege hereinkam;
     * `user_documents` trägt, was jemand selbst hochgeladen hat —
     * über das Gespräch und seit heute über die Ablage auf dieser
     * Seite.
     *
     * Dass die Seite bisher nur die erste zeigte, war der eigentliche
     * Mangel: Wer im Gespräch einen Lebenslauf hochlud und danach
     * hierherkam, sah „Noch keine Unterlagen".
     */
    withUser(db, user.id, (tx) =>
      tx
        .select({
          id: schema.userDocuments.id,
          filename: schema.userDocuments.originalFilename,
          mimeType: schema.userDocuments.mimeType,
          sizeBytes: schema.userDocuments.byteSize,
          kind: schema.userDocuments.declaredKind,
          createdAt: schema.userDocuments.createdAt,
        })
        .from(schema.userDocuments)
        .where(and(eq(schema.userDocuments.userId, user.id), isNull(schema.userDocuments.deletedAt)))
        .orderBy(desc(schema.userDocuments.createdAt)),
    ).catch(() => []),
  ]);

  return (
    <div className="grid gap-9">
      <PageHeader
        eyebrow="Unterlagen"
        title="Dokumente"
        lead="Was du mitgebracht hast und was daraus entstanden ist. Jede Fassung bleibt erhalten."
      />

      {integrations.storage !== "connected" && (
        <div
          role="note"
          className="flex flex-wrap items-center gap-3 rounded-(--radius-md) border border-line-2 bg-inset px-4 py-3"
        >
          <Badge tone="outline">lokale Ablage</Badge>
          <p className="text-sm text-ink-2">
            Dateien liegen auf diesem Rechner, nicht in einem Objektspeicher. Für den Betrieb ist
            das nicht vorgesehen — die Einrichtung steht unter Einstellungen → Verbundene Dienste.
          </p>
        </div>
      )}

      <section aria-labelledby="hochgeladen" className="grid gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="hochgeladen" className="font-display text-xl font-normal">
            Von dir hochgeladen
          </h2>
          <Button asChild variant="secondary" size="sm">
            <Link href="/app/monday">
              <Upload className="size-4" strokeWidth={1.8} />
              Im Gespräch hochladen
            </Link>
          </Button>
        </div>

        <Ablagefeld />

        {abgelegt.length > 0 && (
          <Card padded={false}>
            <ul className="divide-y divide-line">
              {abgelegt.map((doc) => (
                <li key={doc.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <FileText className="size-4 shrink-0 text-ink-3" strokeWidth={1.7} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{doc.filename}</span>
                    <span className="block text-xs text-ink-3">
                      {doc.mimeType} · {Math.round(doc.sizeBytes / 1024)} kB ·{" "}
                      {doc.createdAt.toLocaleDateString("de-DE")}
                    </span>
                  </span>
                  <Badge>{KIND_LABEL[doc.kind] ?? doc.kind}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {uploaded.length === 0 ? (
          abgelegt.length === 0 && (
            <p className="text-sm leading-relaxed text-ink-2">
              Ein Lebenslauf beschleunigt das Gespräch erheblich: Monday fragt dann nur noch nach
              dem, was darin fehlt.
            </p>
          )
        ) : (
          <Card padded={false}>
            <ul className="divide-y divide-line">
              {uploaded.map((doc) => (
                <li key={doc.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <FileText className="size-4 shrink-0 text-ink-3" strokeWidth={1.7} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{doc.filename}</span>
                    <span className="block text-xs text-ink-3">
                      {doc.mimeType} · {Math.round(doc.sizeBytes / 1024)} kB ·{" "}
                      {new Intl.DateTimeFormat("de-DE").format(doc.createdAt)}
                    </span>
                  </span>
                  {doc.extractedText ? (
                    <Badge tone="positive">ausgewertet</Badge>
                  ) : (
                    <Badge tone="outline">nicht ausgewertet</Badge>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section aria-labelledby="erzeugt" className="grid gap-4">
        <h2 id="erzeugt" className="font-display text-xl font-normal">
          Aus deinem Profil entstanden
        </h2>

        {generated.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-5" strokeWidth={1.7} />}
            title="Noch nichts erzeugt"
            body="Unterlagen entstehen im Bewerbungsstudio — jede Aussage darin hängt an einer bestätigten Angabe aus deinem Karriereprofil."
          />
        ) : (
          <Card padded={false}>
            <ul className="divide-y divide-line">
              {generated.map((artifact) => (
                <li key={artifact.id}>
                  <Link
                    href={`/app/applications/${artifact.applicationId}`}
                    className="flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-inset/60"
                  >
                    <FileText className="size-4 shrink-0 text-ink-3" strokeWidth={1.7} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {KIND_LABEL[artifact.kind] ?? artifact.kind}
                        <span className="ml-2 font-mono text-xs text-ink-3">v{artifact.version}</span>
                      </span>
                      <span className="block text-xs text-ink-3">
                        {new Intl.DateTimeFormat("de-DE").format(artifact.createdAt)}
                      </span>
                    </span>
                    {artifact.approvedByUser ? (
                      <Badge tone="positive">freigegeben</Badge>
                    ) : (
                      <Badge tone="outline">Entwurf</Badge>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
