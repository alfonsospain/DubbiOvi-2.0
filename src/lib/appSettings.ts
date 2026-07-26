/**
 * Helper module for reading and writing application preferences via IPC to AppSettingsService.
 * Turbopack/Browser safe with graceful web fallback when running outside Electron.
 */

export async function getAppSetting<T = any>(key: string, defaultValue?: T): Promise<T> {
  const isElectron = typeof window !== 'undefined' && (window as any).electron?.getAppSetting !== undefined;
  if (!isElectron) {
    return defaultValue as T;
  }
  try {
    const val = await (window as any).electron.getAppSetting(key, defaultValue);
    return val !== undefined && val !== null ? val : (defaultValue as T);
  } catch (err) {
    console.error(`[appSettings] Failed to get setting '${key}':`, err);
    return defaultValue as T;
  }
}

export async function setAppSetting(key: string, value: any): Promise<boolean> {
  const isElectron = typeof window !== 'undefined' && (window as any).electron?.setAppSetting !== undefined;
  if (!isElectron) {
    return false;
  }
  try {
    const res = await (window as any).electron.setAppSetting(key, value);
    return !!res?.success;
  } catch (err) {
    console.error(`[appSettings] Failed to set setting '${key}':`, err);
    return false;
  }
}
