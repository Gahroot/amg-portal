/**
 * Cross-platform secure storage wrapper.
 *
 * On native (iOS/Android) this lazily loads `expo-secure-store` (which uses
 * Keychain / Keystore).  On web the native module is not available and would
 * crash with "getValueWithKeyAsync is not a function", so we fall back to
 * `localStorage`.
 *
 * The import **must** be lazy (`require` inside the function body) because
 * `expo-secure-store` eagerly evaluates `requireNativeModule('ExpoSecureStore')`
 * at module-load time, and also accesses `.AFTER_FIRST_UNLOCK` etc. on the
 * result — both of which fail on web.
 */
import { Platform } from 'react-native';

type SecureStoreModule = typeof import('expo-secure-store');

let _mod: SecureStoreModule | null | undefined;

function getSecureStore(): SecureStoreModule | null {
  if (_mod !== undefined) return _mod;
  if (Platform.OS === 'web') {
    _mod = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _mod = require('expo-secure-store') as SecureStoreModule;
  } catch {
    _mod = null;
  }
  return _mod;
}

export async function getItemAsync(key: string): Promise<string | null> {
  const mod = getSecureStore();
  if (mod) {
    return mod.getItemAsync(key);
  }
  // Web fallback
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  const mod = getSecureStore();
  if (mod) {
    await mod.setItemAsync(key, value);
    return;
  }
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage full or blocked
  }
}

export async function deleteItemAsync(key: string): Promise<void> {
  const mod = getSecureStore();
  if (mod) {
    await mod.deleteItemAsync(key);
    return;
  }
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore
  }
}
