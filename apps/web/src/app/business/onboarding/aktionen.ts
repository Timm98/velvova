"use server";

import { revalidatePath } from "next/cache";
import { arbeitgeberKontext } from "@/lib/arbeitgeber/zugang";
import {
  angabeBestaetigen,
  angabenLaden,
  angabenSchreiben,
  gespraechHolen,
  nachrichtSchreiben,
} from "@/lib/arbeitgeber/onboarding/angaben";
import { verstehe } from "@/lib/arbeitgeber/onboarding/deutung";
import { leerformeln, naechsterZug, quittung, type Zug } from "@/lib/arbeitgeber/onboarding/fuehrung";
import { alsWert, feldFinden } from "@/lib/arbeitgeber/onboarding/felder";
import type { Angabe } from "@/lib/arbeitgeber/onboarding/bewertung";

/**
 * Ein Zug im Onboarding-Gespräch.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum der Kontext hier noch einmal geholt wird
 * ══════════════════════════════════════════════════════════════
 *
 * `arbeitgeberKontext()` steht schon im Seitenaufbau. Es steht hier
 * trotzdem: Eine Serveraktion ist ein Endpunkt und lässt sich
 * aufrufen, ohne die Seite je geöffnet zu haben. Die Gesprächs-ID
 * kommt deshalb auch nicht vom Client — sie wird aus der Organisation
 * abgeleitet, die zur angemeldeten Person gehört.
 *
 * Käme sie vom Client, liesse sich das Gespräch einer fremden Firma
 * fortsetzen, indem man eine andere ID schickt.
 */

export type ZugAntwort = {
  ok: boolean;
  nina: Zug;
  /** Was Monday aus der Antwort gelesen hat — als Text für den Verlauf. */
  quittung: string;
  angaben: Angabe[];
  /** Ob das Modell mitgelesen hat oder nur die Regeln. */
  gedeutet: boolean;
};

const MAX_EINGABE = 4000;

export async function zugSenden(eingabe: {
  text: string;
  /** Der Rohtext der Spracherkennung, falls gesprochen wurde. */
  transkriptRoh?: string | null;
}): Promise<ZugAntwort> {
  const { user, organisation } = await arbeitgeberKontext();

  const text = eingabe.text.trim().slice(0, MAX_EINGABE);
  const gespraech = await gespraechHolen({
    organizationId: organisation.organizationId,
    userId: user.id,
  });

  if (text.length === 0) {
    const angaben = await angabenLaden(gespraech.id, user.id);
    return {
      ok: false,
      nina: naechsterZug({ angaben, bereitsGefragt: await gefragtBisher(gespraech.id, user.id) }),
      quittung: "",
      angaben,
      gedeutet: false,
    };
  }

  await nachrichtSchreiben({
    gespraechId: gespraech.id,
    organizationId: organisation.organizationId,
    userId: user.id,
    rolle: "mensch",
    text,
    transkriptRoh: eingabe.transkriptRoh ?? null,
  });

  const { funde, gedeutet } = await verstehe({ text });

  if (funde.length > 0) {
    await angabenSchreiben({
      gespraechId: gespraech.id,
      organizationId: organisation.organizationId,
      userId: user.id,
      angaben: funde.map((f) => ({
        bereich: f.bereich,
        feld: f.feld,
        wert: f.wert,
        quelle: f.quelle,
        /* Die Belegstelle IST das Quelldetail. Ohne sie stünde
           später „Konfidenz 65“ ohne Grundlage da. */
        quelleDetail: f.belegstelle,
        konfidenz: f.konfidenz,
        status: f.status,
      })),
    });
  }

  const angaben = await angabenLaden(gespraech.id, user.id);
  const zug = naechsterZug({
    angaben,
    letzteAntwort: text,
    bereitsGefragt: await gefragtBisher(gespraech.id, user.id),
  });

  const bestaetigung = quittung(funde);
  await nachrichtSchreiben({
    gespraechId: gespraech.id,
    organizationId: organisation.organizationId,
    userId: user.id,
    rolle: "nina",
    text: bestaetigung ? `${bestaetigung}\n\n${zug.text}` : zug.text,
  });

  revalidatePath("/business/onboarding");
  return { ok: true, nina: zug, quittung: bestaetigung, angaben, gedeutet };
}

/**
 * Wonach in diesem Gespräch schon gefragt wurde.
 *
 * ── Warum aus dem Verlauf und nicht aus einer Spalte ──────────
 *
 * Eine Spalte „zuletzt gefragt“ wäre der zweite Ort, an dem dieselbe
 * Tatsache steht — und der, der irgendwann nicht mehr stimmt. Der
 * Verlauf ist die Tatsache: Was Monday gesagt hat, steht darin.
 */
async function gefragtBisher(gespraechId: string, userId: string): Promise<string[]> {
  const { verlaufLaden } = await import("@/lib/arbeitgeber/onboarding/angaben");
  const verlauf = await verlaufLaden(gespraechId, userId);
  const ninaTexte = verlauf.filter((n) => n.rolle === "nina").map((n) => n.text);

  const gefragt: string[] = [];
  const { FELDER } = await import("@/lib/arbeitgeber/onboarding/felder");

  for (const f of FELDER) {
    if (f.frage && ninaTexte.some((t) => t.includes(f.frage!))) {
      gefragt.push(`${f.bereich}.${f.feld}`);
    }
    if (f.nachfrage && ninaTexte.some((t) => t.includes(f.nachfrage!))) {
      gefragt.push(`nachfrage:${f.bereich}.${f.feld}`);
    }
  }
  for (const t of ninaTexte) {
    for (const l of leerformeln(t)) gefragt.push(`leerformel:${l.label}`);
  }
  return gefragt;
}

/**
 * Eine Angabe von Hand setzen — aus der Vorschau heraus.
 *
 * Was hier ankommt, gilt als bestätigt: Ein Mensch hat es getippt.
 * `angabenSchreiben` setzt Konfidenz und Status selbst, wenn die
 * Quelle „nutzer“ ist — hier steht deshalb kein Wert dafür.
 */
export async function angabeSetzen(eingabe: {
  bereich: string;
  feld: string;
  /** So, wie es getippt wurde. Die Umwandlung passiert hier. */
  wert: string;
}): Promise<{ ok: boolean; text: string; angaben: Angabe[] }> {
  const { user, organisation } = await arbeitgeberKontext();

  /* Nur Felder, die es gibt. Sonst wäre die Aktion eine offene Tür in
     die Tabelle. */
  const feld = feldFinden(eingabe.bereich, eingabe.feld);
  if (!feld) return { ok: false, text: "Dieses Feld gibt es nicht.", angaben: [] };

  /*
   * „25“ wird zur Zahl 25, „Excel, SAP“ zur Liste.
   *
   * Und zwar hier, nicht im Browser: Dieselbe Aktion nimmt auch, was
   * ein Skript ihr schickt. Eine Umwandlung, die nur im Formular
   * stattfindet, ist eine Bequemlichkeit für die Tastatur und keine
   * Regel für die Tabelle.
   */
  const wert = alsWert(feld, eingabe.wert);
  if (wert === null) {
    return {
      ok: false,
      text:
        feld.art === "zahl" ? "Dafür brauche ich eine Zahl."
        : feld.art === "spanne" ? "Schreib die Spanne als „von bis“, etwa 65.000 bis 80.000."
        : "Das kann ich so nicht übernehmen.",
      angaben: [],
    };
  }

  const gespraech = await gespraechHolen({
    organizationId: organisation.organizationId,
    userId: user.id,
  });

  await angabenSchreiben({
    gespraechId: gespraech.id,
    organizationId: organisation.organizationId,
    userId: user.id,
    angaben: [{ bereich: eingabe.bereich, feld: eingabe.feld, wert, quelle: "nutzer" }],
  });

  revalidatePath("/business/onboarding");
  return {
    ok: true,
    text: "Übernommen.",
    angaben: await angabenLaden(gespraech.id, user.id),
  };
}

/** Bestätigen, was Monday verstanden hat — oder als „gibt es nicht“ ablegen. */
export async function angabeQuittieren(eingabe: {
  bereich: string;
  feld: string;
  status: "bestaetigt" | "nicht_angegeben";
}): Promise<{ ok: boolean; angaben: Angabe[] }> {
  const { user, organisation } = await arbeitgeberKontext();
  const gespraech = await gespraechHolen({
    organizationId: organisation.organizationId,
    userId: user.id,
  });

  await angabeBestaetigen({
    gespraechId: gespraech.id,
    userId: user.id,
    bereich: eingabe.bereich,
    feld: eingabe.feld,
    status: eingabe.status,
  });

  revalidatePath("/business/onboarding");
  return { ok: true, angaben: await angabenLaden(gespraech.id, user.id) };
}

/* ══════════════════════════════════════════════════════════════
   Andere Quellen: Website und Dokumente
   ══════════════════════════════════════════════════════════════ */

export type QuellAntwort = {
  ok: boolean;
  text: string;
  angaben: Angabe[];
  /** Wie viele Angaben dazugekommen sind. */
  neu: number;
};

/**
 * Funde aus einer anderen Quelle ablegen.
 *
 * ── Warum sie bestehende Angaben nicht überschreiben ──────────
 *
 * Was im Gespräch gesagt wurde, ist jünger und stammt von einem
 * Menschen. Eine Website ist ein Fundstück: manchmal aktuell,
 * manchmal fünf Jahre alt. Sie darf ergänzen und nicht ersetzen —
 * sonst macht ein Klick auf „Website lesen“ aus einer gerade
 * gegebenen Antwort wieder eine alte Angabe.
 */
async function quellfundeAblegen(opt: {
  funde: { bereich: string; feld: string; wert: unknown; quelle: Angabe["quelle"]; status: Angabe["status"]; konfidenz: number; belegstelle: string }[];
  herkunft: string;
  gespraechId: string;
  organizationId: string;
  userId: string;
}): Promise<number> {
  const vorhanden = await angabenLaden(opt.gespraechId, opt.userId);
  const belegt = new Set(
    vorhanden
      .filter((a) => a.status !== "nicht_angegeben")
      .map((a) => `${a.bereich}.${a.feld}`),
  );

  const neu = opt.funde.filter((f) => !belegt.has(`${f.bereich}.${f.feld}`));
  if (neu.length === 0) return 0;

  await angabenSchreiben({
    gespraechId: opt.gespraechId,
    organizationId: opt.organizationId,
    userId: opt.userId,
    angaben: neu.map((f) => ({
      bereich: f.bereich,
      feld: f.feld,
      wert: f.wert,
      quelle: f.quelle,
      /* Woher UND wo. Ohne die Herkunft stünde später eine
         Belegstelle da, zu der niemand die Quelle findet. */
      quelleDetail: `${opt.herkunft}: „${f.belegstelle}“`,
      konfidenz: f.konfidenz,
      status: f.status,
    })),
  });
  return neu.length;
}

/** Die eigene Website lesen lassen. */
export async function websiteLesen(adresse: string): Promise<QuellAntwort> {
  const { user, organisation } = await arbeitgeberKontext();
  const { vonWebsite } = await import("@/lib/arbeitgeber/onboarding/quellen");

  const gespraech = await gespraechHolen({
    organizationId: organisation.organizationId,
    userId: user.id,
  });

  const ergebnis = await vonWebsite(adresse.trim().slice(0, 2000));
  const herkunft = (() => {
    try {
      return new URL(adresse.trim()).hostname;
    } catch {
      return "Website";
    }
  })();

  const neu = ergebnis.ok
    ? await quellfundeAblegen({
        funde: ergebnis.funde,
        herkunft,
        gespraechId: gespraech.id,
        organizationId: organisation.organizationId,
        userId: user.id,
      })
    : 0;

  await nachrichtSchreiben({
    gespraechId: gespraech.id,
    organizationId: organisation.organizationId,
    userId: user.id,
    rolle: "nina",
    text: ergebnis.text,
  });

  revalidatePath("/business/onboarding");
  return {
    ok: ergebnis.ok,
    text: ergebnis.text,
    angaben: await angabenLaden(gespraech.id, user.id),
    neu,
  };
}

/** Ein Dokument lesen lassen. */
export async function dokumentLesen(formular: FormData): Promise<QuellAntwort> {
  const { user, organisation } = await arbeitgeberKontext();
  const { vonDokument } = await import("@/lib/arbeitgeber/onboarding/quellen");

  const datei = formular.get("datei");
  if (!(datei instanceof File) || datei.size === 0) {
    return { ok: false, text: "Da war keine Datei dabei.", angaben: [], neu: 0 };
  }

  const gespraech = await gespraechHolen({
    organizationId: organisation.organizationId,
    userId: user.id,
  });

  const ergebnis = await vonDokument({
    mime: datei.type,
    name: datei.name,
    daten: new Uint8Array(await datei.arrayBuffer()),
  });

  const neu = ergebnis.ok
    ? await quellfundeAblegen({
        funde: ergebnis.funde,
        herkunft: datei.name,
        gespraechId: gespraech.id,
        organizationId: organisation.organizationId,
        userId: user.id,
      })
    : 0;

  await nachrichtSchreiben({
    gespraechId: gespraech.id,
    organizationId: organisation.organizationId,
    userId: user.id,
    rolle: "nina",
    text: ergebnis.text,
  });

  revalidatePath("/business/onboarding");
  return {
    ok: ergebnis.ok,
    text: ergebnis.text,
    angaben: await angabenLaden(gespraech.id, user.id),
    neu,
  };
}
