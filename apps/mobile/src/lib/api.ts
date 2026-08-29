import { readToken } from "./session.ts";

/**
 * Der API-Client.
 *
 * Er spricht dieselbe API wie spaetere Partner und teilt sich die
 * Domaenentypen mit dem Web. Was er NICHT tut: Nutzerinhalte
 * zwischenspeichern. Auf einem Geraet, das jemand anderem in die Haende
 * faellt, sollen keine Bewerbungsunterlagen liegen.
 */

export interface ApiOptions {
  baseUrl: string;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function createClient({ baseUrl }: ApiOptions) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await readToken();
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Cookie: `paycheck_session=${token}` } : {}),
        ...init.headers,
      },
    });

    if (!response.ok) {
      throw new ApiError(
        response.status,
        response.status === 401
          ? "Nicht angemeldet."
          : `Die Anfrage ist fehlgeschlagen (${response.status}).`,
      );
    }
    return (await response.json()) as T;
  }

  return {
    health: () => request<{ status: string; modus: string }>("/health"),
    integrations: () =>
      request<{
        modus: string;
        ki: { zustand: string; hinweis: string };
        email: { zustand: string; hinweis: string };
      }>("/status/integrations"),
    methodology: () =>
      request<{ fassung: string; grundsatz: string; grenzen: string[] }>("/methodology"),
  };
}
