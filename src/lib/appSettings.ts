/**
 * Helper module for reading and writing application preferences via IPC to AppSettingsService.
 * Turbopack/Browser/Node safe with an in-memory fallback cache when running outside Electron.
 */

const fallbackMemoryCache = new Map<string, any>();

export async function getAppSetting<T = any>(key: string, defaultValue?: T): Promise<T> {
  const isElectron = typeof window !== 'undefined' && (window as any).electron?.getAppSetting !== undefined;
  if (!isElectron) {
    return fallbackMemoryCache.has(key) ? (fallbackMemoryCache.get(key) as T) : (defaultValue as T);
  }
  try {
    const val = await (window as any).electron.getAppSetting(key, defaultValue);
    return val !== undefined && val !== null ? val : (defaultValue as T);
  } catch (err) {
    console.error(`[appSettings] Failed to get setting '${key}':`, err);
    return fallbackMemoryCache.has(key) ? (fallbackMemoryCache.get(key) as T) : (defaultValue as T);
  }
}

export async function setAppSetting(key: string, value: any): Promise<boolean> {
  const isElectron = typeof window !== 'undefined' && (window as any).electron?.setAppSetting !== undefined;
  fallbackMemoryCache.set(key, value);

  if (!isElectron) {
    return true;
  }
  try {
    const res = await (window as any).electron.setAppSetting(key, value);
    return !!res?.success;
  } catch (err) {
    console.error(`[appSettings] Failed to set setting '${key}':`, err);
    return true;
  }
}
