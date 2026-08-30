"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitCoachingAnswer } from "@/lib/coaching";
import { Badge, buttonClass, Card, Stack } from "@/components/ui";

/**
 * Eine Uebungsrunde. Eine Frage, eine Antwort, eine Rückmeldung zu
 * Inhalt und Aufbau - und die Möglichkeit, es noch einmal zu versuchen.
 */
export function CoachingSession({
  sessionId,
  questions,
  turns,
  feedback,
  labels,
}: {
  sessionId: string;
  questions: { key: string; text: string; origin: string }[];
  turns: { id: string; role: string; content: string; questionKey: string | null }[];
  feedback: {
    turnId: string;
    relevance: string | null;
    structure: string | null;
    concreteEvidence: string | null;
    clarity: string | null;
    missingPoints: string[];
  }[];
  labels: Record<
    "start" | "repeat" | "relevance" | "structure" | "evidence" | "clarity" | "missing" | "yourAnswer" | "send",
    string
  >;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);

  const question = questions[index];
  const answered = turns.filter((t) => t.questionKey === question?.key);
  const lastAnswer = answered.at(-1);
  const lastFeedback = lastAnswer ? feedback.find((f) => f.turnId === lastAnswer.id) : undefined;

  if (!question) return null;

  function submit() {
    const trimmed = answer.trim();
    if (trimmed.length < 10) {
      setError("Schreib etwas mehr - unter zehn Zeichen lässt sich nichts sagen.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await submitCoachingAnswer(sessionId, question!.key, trimmed);
      if (!r.ok) setError(r.message);
      else setAnswer("");
      router.refresh();
    });
  }

  return (
    <Stack gap={4}>
      <Card>
        <Stack gap={4}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
              Frage {index + 1} von {questions.length}
            </span>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <button
                type="button"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
                className={buttonClass("quiet", false, "sm")}
              >
                Zurück
              </button>
              <button
                type="button"
                onClick={() => {
                  setIndex((i) => Math.min(questions.length - 1, i + 1));
                  setAnswer("");
                }}
                disabled={index === questions.length - 1}
                className={buttonClass("quiet", false, "sm")}
              >
                Weiter
              </button>
            </div>
          </div>

          <p style={{ fontSize: "var(--text-lg)", lineHeight: 1.5, maxWidth: "var(--measure)" }}>
            {question.text}
          </p>

          <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
            Woher diese Frage kommt: {question.origin}
          </p>

          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            <label htmlFor="coach-answer" className="sr-only">
              {labels.yourAnswer}
            </label>
            <textarea
              id="coach-answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={6}
              placeholder="Situation, was du getan hast, was daraus wurde."
              aria-invalid={error ? true : undefined}
              style={{
                width: "100%",
                padding: "var(--space-3) var(--space-4)",
                border: `1px solid ${error ? "var(--critical)" : "var(--border-default)"}`,
                borderRadius: "var(--radius-md)",
                background: "var(--surface-raised)",
                fontSize: "var(--text-base)",
                lineHeight: 1.6,
                resize: "vertical",
              }}
            />
            {error && (
              <p role="alert" style={{ fontSize: "var(--text-sm)", color: "var(--critical)" }}>
                {error}
              </p>
            )}
            <div>
              <button type="button" onClick={submit} disabled={pending} className={buttonClass("primary")}>
                {pending ? "…" : answered.length > 0 ? labels.repeat : labels.send}
              </button>
            </div>
          </div>
        </Stack>
      </Card>

      {lastAnswer && (
        <Card>
          <Stack gap={4}>
            <h3 style={{ fontSize: "var(--text-base)" }}>Deine letzte Antwort</h3>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", whiteSpace: "pre-wrap", background: "var(--surface-sunken)", padding: "var(--space-3)", borderRadius: "var(--radius-md)" }}>
              {lastAnswer.content}
            </p>

            {lastFeedback && (
              <dl style={{ display: "grid", gap: "var(--space-3)", margin: 0, fontSize: "var(--text-sm)" }}>
                {[
                  [labels.relevance, lastFeedback.relevance],
                  [labels.structure, lastFeedback.structure],
                  [labels.evidence, lastFeedback.concreteEvidence],
                  [labels.clarity, lastFeedback.clarity],
                ]
                  .filter(([, v]) => v)
                  .map(([label, value]) => (
                    <div key={label as string}>
                      <dt style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", textTransform: "uppercase" }}>
                        {label}
                      </dt>
                      <dd style={{ margin: 0 }}>{value}</dd>
                    </div>
                  ))}

                {lastFeedback.missingPoints.length > 0 && (
                  <div>
                    <dt style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", textTransform: "uppercase" }}>
                      {labels.missing}
                    </dt>
                    <dd style={{ margin: 0 }}>
                      <ul style={{ listStyle: "none", display: "grid", gap: 4 }}>
                        {lastFeedback.missingPoints.map((m) => (
                          <li key={m}>· {m}</li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
