import { beforeEach, describe, expect, it, vi } from "vitest";

const eingerichtet = vi.fn(() => true);
const signInWithOtp = vi.fn();
const verifyOtp = vi.fn();
const signOut = vi.fn(async () => undefined);

vi.mock("@/lib/supabase/config", () => ({
  isSupabaseConfigured: () => eingerichtet(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { signInWithOtp, verifyOtp, signOut },
  }),
}));

const { supabaseCodePruefen, supabaseCodeSenden, supabaseVersandMoeglich } = await import(
  "./supabase-code"
);

beforeEach(() => {
  eingerichtet.mockReturnValue(true);
  signInWithOtp.mockReset().mockResolvedValue({ error: null });
  verifyOtp.mockReset();
  signOut.mockClear();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("supabaseCodeSenden", () => {
  it("bittet Supabase um sechs Ziffern, nicht um einen Link", async () => {
    await supabaseCodeSenden("a@b.de");
    const arg = signInWithOtp.mock.calls[0]![0];
    expect(arg.email).toBe("a@b.de");
    expect(arg.options.shouldCreateUser).toBe(true);
    /* Eine Zieladresse machte aus der Mail eine Einladung zum Klicken. */
    expect(arg.options.emailRedirectTo).toBeUndefined();
  });

  it("meldet fehlende Einrichtung, ohne Supabase zu fragen", async () => {
    eingerichtet.mockReturnValue(false);
    const e = await supabaseCodeSenden("a@b.de");
    expect(e).toMatchObject({ ok: false, grund: "nicht_eingerichtet" });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("macht aus der Team-Beschränkung keine Aussage über die Adresse", async () => {
    signInWithOtp.mockResolvedValue({ error: { message: "Email address not authorized" } });
    const e = await supabaseCodeSenden("fremd@firma.de");
    expect(e.ok).toBe(false);
    expect(e).toMatchObject({ grund: "abgelehnt" });
    /* Der Wortlaut des Anbieters darf nicht durchschlagen — sonst hält
       jemand seine eigene Adresse für falsch. */
    expect("text" in e && e.text.toLowerCase()).not.toContain("not authorized");
  });

  it("erkennt die Drosselung", async () => {
    signInWithOtp.mockResolvedValue({ error: { message: "email rate limit exceeded" } });
    expect(await supabaseCodeSenden("a@b.de")).toMatchObject({ grund: "gedrosselt" });
  });

  it("fällt bei einem geworfenen Fehler nicht durch", async () => {
    signInWithOtp.mockRejectedValue(new Error("Netz"));
    expect(await supabaseCodeSenden("a@b.de")).toMatchObject({ ok: false, grund: "fehler" });
  });
});

describe("supabaseCodePruefen", () => {
  it("prüft als Typ „email“, passend zu signInWithOtp", async () => {
    verifyOtp.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    expect(await supabaseCodePruefen("a@b.de", "123456")).toBe(true);
    expect(verifyOtp.mock.calls[0]![0]).toMatchObject({ type: "email", token: "123456" });
  });

  it("beendet die Supabase-Sitzung sofort wieder", async () => {
    verifyOtp.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    await supabaseCodePruefen("a@b.de", "123456");
    expect(signOut).toHaveBeenCalled();
  });

  it("ist falsch, wenn Supabase ablehnt", async () => {
    verifyOtp.mockResolvedValue({ data: { user: null }, error: { message: "Token has expired" } });
    expect(await supabaseCodePruefen("a@b.de", "000000")).toBe(false);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("ist falsch, wenn der Aufruf scheitert", async () => {
    verifyOtp.mockRejectedValue(new Error("Netz"));
    expect(await supabaseCodePruefen("a@b.de", "123456")).toBe(false);
  });

  it("fragt ohne Einrichtung gar nicht erst", async () => {
    eingerichtet.mockReturnValue(false);
    expect(await supabaseCodePruefen("a@b.de", "123456")).toBe(false);
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});

describe("supabaseVersandMoeglich", () => {
  it("folgt der Einrichtung", () => {
    eingerichtet.mockReturnValue(true);
    expect(supabaseVersandMoeglich()).toBe(true);
    eingerichtet.mockReturnValue(false);
    expect(supabaseVersandMoeglich()).toBe(false);
  });
});
