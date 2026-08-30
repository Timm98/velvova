import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@paycheck/db";
import type { BoardKind, BoardRegistration } from "./board.ts";

/**
 * Welche Arbeitgeberboards abgerufen werden dürfen.
 *
 * Der Zwischenspeicher ist hier kein Geschwindigkeitstrick: der Adapter
 * fragt die Registrierungen bei jedem `isConfigured()` ab, und das
 * passiert oft. Eine Minute ist frisch genug — wird ein Board
 * abgeschaltet, dauert es höchstens so lange, bis der nächste Abruf es
 * merkt, und der Not-Aus in der Quellen-Registry wirkt ohnehin sofort.
 */

const CACHE_MS = 60_000;
let cache: { at: number; rows: BoardRegistration[] } | null = null;

export async function loadRegistrations(board: BoardKind): Promise<BoardRegistration[]> {
  const alle = await loadAll();
  return alle.filter((r) => r.board === board).map(({ board: _, ...rest }) => rest);
}

type Zeile = BoardRegistration & { board: BoardKind };

async function loadAll(now = Date.now()): Promise<Zeile[]> {
  if (cache && now - cache.at < CACHE_MS) return cache.rows as Zeile[];

  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.employerBoards)
    .where(eq(schema.employerBoards.enabled, true));

  const registrations: Zeile[] = rows.map((r) => ({
    board: r.board as BoardKind,
    boardToken: r.boardToken,
    employerName: r.employerName,
    authorization: {
      kind: r.authorizationKind as BoardRegistration["authorization"]["kind"],
      reference: r.authorizationReference,
      verifiedAt: r.verifiedAt,
    },
  }));

  cache = { at: now, rows: registrations };
  return registrations;
}

export function resetRegistrationCache(): void {
  cache = null;
}

/**
 * Ein Board eintragen.
 *
 * Die Autorisierung ist ein Pflichtfeld ohne Standardwert. Ein leeres
 * Feld wäre keine Autorisierung, sondern eine fehlende — und der
 * Unterschied ist genau der, um den es hier geht.
 */
export async function registerBoard(input: {
  board: BoardKind;
  boardToken: string;
  employerName: string;
  employerDomain?: string;
  authorizationKind: BoardRegistration["authorization"]["kind"];
  authorizationReference: string;
  verifiedAt: Date;
}): Promise<void> {
  if (!input.authorizationReference.trim()) {
    throw new Error(
      "Ohne Beleg der Berechtigung wird kein Arbeitgeberboard eingetragen. " +
        "Verifizierte Domäne, schriftliche Freigabe oder eigenes Arbeitgeberkonto.",
    );
  }

  const db = await getDb();
  await db
    .insert(schema.employerBoards)
    .values({
      board: input.board,
      boardToken: input.boardToken,
      employerName: input.employerName,
      employerDomain: input.employerDomain ?? null,
      authorizationKind: input.authorizationKind,
      authorizationReference: input.authorizationReference.trim(),
      verifiedAt: input.verifiedAt,
    })
    .onConflictDoUpdate({
      target: [schema.employerBoards.board, schema.employerBoards.boardToken],
      set: {
        employerName: input.employerName,
        employerDomain: input.employerDomain ?? null,
        authorizationKind: input.authorizationKind,
        authorizationReference: input.authorizationReference.trim(),
        verifiedAt: input.verifiedAt,
        enabled: true,
        disabledReason: null,
        updatedAt: new Date(),
      },
    });

  resetRegistrationCache();
}

/** Abschalten ohne Löschen: die Nachvollziehbarkeit bleibt. */
export async function disableBoard(
  board: BoardKind,
  boardToken: string,
  reason: string,
): Promise<void> {
  const db = await getDb();
  await db
    .update(schema.employerBoards)
    .set({ enabled: false, disabledReason: reason, updatedAt: new Date() })
    .where(
      and(eq(schema.employerBoards.board, board), eq(schema.employerBoards.boardToken, boardToken)),
    );
  resetRegistrationCache();
}
