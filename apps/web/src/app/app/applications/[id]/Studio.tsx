"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveArtifact, generateArtifact, sendApplication, updateArtifact } from "@/lib/studio";
import type { StudioView } from "@/lib/studio";
import { Badge, buttonClass, Card, Stack } from "@/components/ui";

/**
 * Das Studio.
 *
 * Links die Anforderungen und Belege, in der Mitte das Dokument, rechts
 * die Prüfung. Eine unbelegte Aussage sperrt die Freigabe - das steht
 * nicht als Warnung da, sondern der Knopf ist tatsächlich aus.
 */

type Labels = Record<
  | "requirements" | "yourEvidence" | "document" | "checks" | "openPoints"
  | "generateCvAts" | "generateCoverLetter" | "generateEmail"
  | "claimSupported" | "claimUnsupported" | "claimNeedsConfirmation" | "unsupportedBlocked"
  | "preview" | "recipient" | "subject" | "confirmSend" | "send" | "exportDraft"
  | "draftOnlySendNotice" | "coverLetterNotNeeded",
  string
>;

const KIND_LABEL: Record<string, string> = {
  cv_ats: "Lebenslauf (ATS-freundlich)",
  cv_designed: "Lebenslauf (gestaltet)",
  cover_letter: "Anschreiben",
  application_email: "Bewerbungs-E-Mail",
  portal_answers: "Portalantworten",
  recruiter_message: "Nachricht an Recruiting",
  attachment_list: "Anlagenverzeichnis",
  portfolio_checklist: "Nachweis-Checkliste",
};

export function Studio({ view, labels }: { view: StudioView; labels: Labels }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(view.artifacts[0]?.id ?? null);
  const [draftText, setDraftText] = useState<string | null>(null);
  /*
   * Der getippte Text des Editors — hier oben, nicht im Editor.
   *
   * ── Was passiert ist ──────────────────────────────────────
   *
   * Der Editor hielt seinen Text in eigenem Zustand, angelegt aus
   * `artifact.content`. Trifft nach dem Erzeugen ein spätes Neuladen
   * ein, wird er neu eingehängt — und der Zustand beginnt wieder beim
   * Serverwert. Gemessen: Getippter Text war nach 500 Millisekunden
   * überschrieben, ohne Meldung, ohne Rückfrage.
   *
   * Jemand, der an seiner Bewerbung schreibt, verliert dabei seine
   * Worte. Das ist der schlimmste Datenverlust, den dieses Produkt
   * haben kann.
   *
   * ── Warum nach Art und nicht nach Kennung ─────────────────
   *
   * Eine neue Fassung desselben Dokuments bekommt eine neue Kennung.
   * Nach Kennung abgelegt wäre der Entwurf genau dann weg, wenn er
   * gebraucht wird. Die Art (Anschreiben, Lebenslauf) bleibt.
   *
   * Bei einer neuen Fassung gewinnt der Entwurf: Was ein Mensch
   * geschrieben hat, wiegt schwerer als was das Modell erzeugt hat.
   * Der Hinweis „Ungespeicherte Änderung" steht daneben.
   */
  const [editorEntwuerfe, setEditorEntwuerfe] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);

  const active = view.artifacts.find((a) => a.id === activeId) ?? view.artifacts[0] ?? null;
  const musts = view.requirements.filter((r) => r.kind === "must");
  const nices = view.requirements.filter((r) => r.kind === "nice");
  const confirmedEvidence = view.evidence.filter((e) => e.confirmed);

  function generate(kind: "cv_ats" | "cover_letter" | "application_email") {
    startTransition(async () => {
      const r = await generateArtifact(view.application.id, kind);
      setMessage({ tone: r.ok ? "ok" : "error", text: r.message });
      router.refresh();
    });
  }

  function approve() {
    if (!active) return;
    startTransition(async () => {
      const r = await approveArtifact(active.id);
      setMessage({ tone: r.ok ? "ok" : "error", text: r.message });
      router.refresh();
    });
  }

  function send() {
    if (!active) return;
    startTransition(async () => {
      const r = await sendApplication(view.application.id, active.id, confirmed);
      setMessage({ tone: r.ok ? "ok" : "error", text: r.message });
      if (r.draft) setDraftText(r.draft.content);
      router.refresh();
    });
  }

  return (
    <>
      <div className="studio-grid">
        {/* --- Links: Anforderungen und Belege --- */}
        <aside style={{ display: "grid", gap: "var(--space-4)", alignContent: "start", minWidth: 0 }}>
          <Card>
            <Stack gap={3}>
              <h2 style={{ fontSize: "var(--text-base)" }}>{labels.requirements}</h2>
              {musts.length === 0 && nices.length === 0 ? (
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                  Die Anzeige nennt keine Anforderungen.
                </p>
              ) : (
                <>
                  {musts.length > 0 && (
                    <div>
                      <h3 style={{ fontSize: "var(--text-xs)", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "var(--space-2)" }}>
                        Muss
                      </h3>
                      <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-2)" }}>
                        {musts.map((r) => (
                          <li key={r.id} style={{ fontSize: "var(--text-sm)" }}>
                            · {r.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {nices.length > 0 && (
                    <div>
                      <h3 style={{ fontSize: "var(--text-xs)", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "var(--space-2)" }}>
                        Kann
                      </h3>
                      <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-2)" }}>
                        {nices.map((r) => (
                          <li key={r.id} style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                            · {r.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </Stack>
          </Card>

          <Card>
            <Stack gap={3}>
              <h2 style={{ fontSize: "var(--text-base)" }}>{labels.yourEvidence}</h2>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                {confirmedEvidence.length} bestätigt von {view.evidence.length} insgesamt. Nur
                Bestätigtes kann eine Aussage tragen.
              </p>
              <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-2)" }}>
                {confirmedEvidence.slice(0, 8).map((e) => (
                  <li key={e.id} style={{ fontSize: "var(--text-sm)", display: "flex", gap: "var(--space-2)" }}>
                    <span aria-hidden style={{ color: "var(--positive)" }}>✓</span>
                    <span>{e.statement.length > 90 ? `${e.statement.slice(0, 90)}…` : e.statement}</span>
                  </li>
                ))}
              </ul>
            </Stack>
          </Card>
        </aside>

        {/* --- Mitte: Dokument --- */}
        <div style={{ display: "grid", gap: "var(--space-4)", alignContent: "start", minWidth: 0 }}>
          {message && (
            <div
              role={message.tone === "error" ? "alert" : "status"}
              style={{
                background: message.tone === "error" ? "var(--critical-subtle)" : "var(--positive-subtle)",
                border: `1px solid ${message.tone === "error" ? "var(--critical)" : "var(--positive)"}`,
                color: message.tone === "error" ? "var(--critical)" : "var(--positive)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-3) var(--space-4)",
                fontSize: "var(--text-sm)",
              }}
            >
              {message.text}
            </div>
          )}

          <Card>
            <Stack gap={4}>
              <h2 style={{ fontSize: "var(--text-base)" }}>{labels.document}</h2>

              <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => generate("cv_ats")}
                  disabled={pending}
                  className={buttonClass("secondary", false, "sm")}
                >
                  {labels.generateCvAts}
                </button>
                <button
                  type="button"
                  onClick={() => generate("application_email")}
                  disabled={pending}
                  className={buttonClass("secondary", false, "sm")}
                >
                  {labels.generateEmail}
                </button>
                <button
                  type="button"
                  onClick={() => generate("cover_letter")}
                  disabled={pending}
                  className={buttonClass("quiet", false, "sm")}
                >
                  {labels.generateCoverLetter}
                </button>
              </div>

              {!view.coverLetterAdvice.advisable && (
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", background: "var(--surface-sunken)", padding: "var(--space-3)", borderRadius: "var(--radius-md)" }}>
                  {view.coverLetterAdvice.reason}
                </p>
              )}

              {view.artifacts.length > 1 && (
                <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                  {view.artifacts.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setActiveId(a.id)}
                      aria-pressed={a.id === active?.id}
                      className={buttonClass(a.id === active?.id ? "secondary" : "quiet", false, "sm")}
                    >
                      {KIND_LABEL[a.kind] ?? a.kind} v{a.version}
                    </button>
                  ))}
                </div>
              )}

              {active ? (
                <ArtifactEditor
                  key={active.id}
                  artifact={active}
                  pending={pending}
                  entwurf={editorEntwuerfe[active.kind]}
                  onChange={(t) => setEditorEntwuerfe((e) => ({ ...e, [active.kind]: t }))}
                  onSave={(text) =>
                    startTransition(async () => {
                      await updateArtifact(active.id, text);
                      /* Gespeichert heisst: der Entwurf ist jetzt der Serverstand. */
                      setEditorEntwuerfe((e) => {
                        const neu = { ...e };
                        delete neu[active.kind];
                        return neu;
                      });
                      setMessage({ tone: "ok", text: "Gespeichert. Die Freigabe wurde zurückgesetzt." });
                      router.refresh();
                    })
                  }
                />
              ) : (
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                  Noch kein Dokument. Wähl oben, was du erstellen möchtest.
                </p>
              )}
            </Stack>
          </Card>
        </div>

        {/* --- Rechts: Prüfung --- */}
        <aside style={{ display: "grid", gap: "var(--space-4)", alignContent: "start", minWidth: 0 }}>
          <Card>
            <Stack gap={3}>
              <h2 style={{ fontSize: "var(--text-base)" }}>{labels.checks}</h2>

              {!active ? (
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                  Sobald ein Dokument da ist, prüfe ich jede Aussage.
                </p>
              ) : active.claims.length === 0 ? (
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                  In diesem Text steht keine prüfbare Behauptung.
                </p>
              ) : (
                <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-4)" }}>
                  {active.claims.map((c, i) => (
                    <li key={i} style={{ display: "grid", gap: "var(--space-2)" }}>
                      <Badge
                        tone={
                          c.status === "supported"
                            ? "positive"
                            : c.status === "needs_confirmation"
                              ? "caution"
                              : "critical"
                        }
                      >
                        {c.status === "supported"
                          ? labels.claimSupported
                          : c.status === "needs_confirmation"
                            ? labels.claimNeedsConfirmation
                            : labels.claimUnsupported}
                      </Badge>
                      <p style={{ fontSize: "var(--text-sm)" }}>
                        {c.text.length > 120 ? `${c.text.slice(0, 120)}…` : c.text}
                      </p>
                      <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{c.note}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Stack>
          </Card>

          {/* Freigabe und Versand */}
          {active && (
            <Card style={{ borderColor: active.canApprove ? "var(--border-subtle)" : "var(--critical)" }}>
              <Stack gap={4}>
                <h2 style={{ fontSize: "var(--text-base)" }}>{labels.preview}</h2>

                {!active.canApprove && (
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--critical)" }}>
                    {labels.unsupportedBlocked}
                  </p>
                )}

                <dl style={{ display: "grid", gap: "var(--space-2)", fontSize: "var(--text-sm)", margin: 0 }}>
                  <div>
                    <dt style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)" }}>{labels.recipient}</dt>
                    <dd style={{ margin: 0 }}>{view.job.applyTarget ?? "nicht angegeben"}</dd>
                  </div>
                  <div>
                    <dt style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)" }}>{labels.subject}</dt>
                    <dd style={{ margin: 0 }}>Bewerbung: {view.job.title}</dd>
                  </div>
                  <div>
                    <dt style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)" }}>Versandweg</dt>
                    <dd style={{ margin: 0 }}>
                      {view.delivery.providerName}
                      {!view.delivery.willActuallySend && (
                        <Badge tone="caution"> versendet nichts</Badge>
                      )}
                    </dd>
                  </div>
                </dl>

                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                  {labels.draftOnlySendNotice}
                </p>

                {!active.approved ? (
                  <button
                    type="button"
                    onClick={approve}
                    disabled={pending || !active.canApprove}
                    className={buttonClass(active.canApprove ? "primary" : "quiet", false, "md")}
                  >
                    Dokument freigeben
                  </button>
                ) : (
                  <Stack gap={3}>
                    <Badge tone="positive">freigegeben</Badge>

                    <label style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(e) => setConfirmed(e.target.checked)}
                        style={{ width: 20, height: 20, marginTop: 2 }}
                      />
                      <span style={{ fontSize: "var(--text-sm)" }}>{labels.confirmSend}</span>
                    </label>

                    <button
                      type="button"
                      onClick={send}
                      disabled={pending || !confirmed}
                      className={buttonClass(confirmed ? "primary" : "quiet", false, "md")}
                    >
                      {view.delivery.willActuallySend ? labels.send : labels.exportDraft}
                    </button>
                  </Stack>
                )}

                {draftText && (
                  <div style={{ display: "grid", gap: "var(--space-2)" }}>
                    <p style={{ fontSize: "var(--text-sm)", color: "var(--positive)" }}>
                      Entwurf erstellt. Kopier ihn in dein Mailprogramm:
                    </p>
                    <textarea
                      readOnly
                      value={draftText}
                      rows={8}
                      style={{
                        width: "100%",
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--text-xs)",
                        padding: "var(--space-3)",
                        border: "1px solid var(--border-default)",
                        borderRadius: "var(--radius-md)",
                        background: "var(--surface-sunken)",
                      }}
                    />
                  </div>
                )}
              </Stack>
            </Card>
          )}
        </aside>
      </div>

      <style>{`
        .studio-grid { display: grid; gap: var(--space-5); grid-template-columns: minmax(0, 1fr); }
        @media (min-width: 1100px) {
          .studio-grid { grid-template-columns: 280px minmax(0, 1fr) 320px; }
        }
      `}</style>
    </>
  );
}

function ArtifactEditor({
  artifact,
  pending,
  entwurf,
  onChange,
  onSave,
}: {
  artifact: StudioView["artifacts"][number];
  pending: boolean;
  /** Der ungespeicherte Text, falls es einen gibt. Lebt beim Elternteil. */
  entwurf: string | undefined;
  onChange: (text: string) => void;
  onSave: (text: string) => void;
}) {
  /*
   * Kein eigener Zustand mehr.
   *
   * Er ging bei jedem Neueinhängen verloren — und die Komponente wird
   * neu eingehängt, sobald eine neue Fassung eintrifft.
   */
  const text = entwurf ?? artifact.content;
  const changed = text !== artifact.content;

  return (
    <div style={{ display: "grid", gap: "var(--space-3)" }}>
      <label htmlFor="artifact" className="sr-only">
        Dokumentinhalt
      </label>
      <textarea
        id="artifact"
        value={text}
        onChange={(e) => onChange(e.target.value)}
        rows={18}
        style={{
          width: "100%",
          padding: "var(--space-4)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-md)",
          background: "var(--surface-raised)",
          fontSize: "var(--text-sm)",
          lineHeight: 1.7,
          fontFamily: artifact.kind === "cv_ats" ? "var(--font-mono)" : "var(--font-sans)",
          resize: "vertical",
        }}
      />
      <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => onSave(text)}
          disabled={pending || !changed}
          className={buttonClass(changed ? "secondary" : "quiet", false, "sm")}
        >
          Speichern
        </button>
        {changed && (
          <span style={{ fontSize: "var(--text-xs)", color: "var(--caution)" }}>
            Ungespeicherte Änderung. Speichern setzt die Freigabe zurück.
          </span>
        )}
      </div>
    </div>
  );
}
