const fs = require('fs');
const path = require('path');

/**
 * Service managing application configuration and persistent settings.
 * Owned explicitly by the Electron main process.
 */
class AppSettingsService {
  /**
   * @param {import('electron').App} app Electron application instance.
   */
  constructor(app) {
    if (!app) {
      throw new Error('AppSettingsService requires an Electron app instance.');
    }
    this.app = app;
    this.settingsPath = path.join(this.app.getPath('userData'), 'settings.json');
    this.cache = null;
  }

  /**
   * Safely reads and parses the settings.json file.
   * Maintains an in-memory cache to minimize disk reads.
   *
   * @returns {Record<string, any>} Settings object.
   */
  loadSettings() {
    if (this.cache !== null) {
      return this.cache;
    }

    if (!fs.existsSync(this.settingsPath)) {
      this.cache = {};
      this.saveSettings();
      return this.cache;
    }

    try {
      const data = fs.readFileSync(this.settingsPath, 'utf8');
      this.cache = JSON.parse(data) || {};
    } catch (err) {
      console.error('[AppSettingsService] Failed to read or parse settings.json:', err);
      this.cache = {};
    }

    return this.cache;
  }

  /**
   * Writes current in-memory settings to settings.json atomically.
   */
  saveSettings() {
    try {
      const dir = path.dirname(this.settingsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.cache || {}, null, 2), 'utf8');
    } catch (err) {
      console.error('[AppSettingsService] Failed to write settings.json:', err);
    }
  }

  /**
   * Retrieves a setting value by key, returning default if not set.
   *
   * @param {string} key Setting key name.
   * @param {any} [defaultValue=null] Default value fallback.
   * @returns {any} Resolved setting value.
   */
  getSetting(key, defaultValue = null) {
    const settings = this.loadSettings();
    return settings[key] !== undefined ? settings[key] : defaultValue;
  }

  /**
   * Updates or inserts a setting key-value pair and persists it.
   *
   * @param {string} key Setting key name.
   * @param {any} value Setting value to persist.
   */
  setSetting(key, value) {
    const settings = this.loadSettings();
    settings[key] = value;
    this.cache = settings;
    this.saveSettings();
  }
}

module.exports = AppSettingsService;
