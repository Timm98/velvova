import * as SecureStore from "expo-secure-store";

/**
 * Sitzungstoken auf dem Geraet.
 *
 * Bewusst in der sicheren Ablage des Betriebssystems - Keychain unter
 * iOS, Keystore unter Android - und nicht in AsyncStorage. Ein Token
 * im Klartext auf einem verlorenen Geraet ist ein Zugang zu allen
 * Bewerbungsunterlagen.
 */

const KEY = "paycheck.session";

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function readToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
