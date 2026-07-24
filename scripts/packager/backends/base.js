/**
 * Abstract Base Class for Platform Packaging Backends (macOS, Windows, Linux)
 */
class BasePlatformPackager {
  constructor(spec) {
    this.spec = spec;
  }

  /**
   * Prepares staging files and copies executable + libraries.
   */
  prepareStaging() {
    throw new Error('prepareStaging() must be implemented by subclass.');
  }

  /**
   * Performs platform-specific relocation (Mach-O RPATH, ELF $ORIGIN, DLL copying).
   */
  processRelocation() {
    throw new Error('processRelocation() must be implemented by subclass.');
  }

  /**
   * Applies code signing or permission settings if applicable.
   */
  applySignatures() {
    throw new Error('applySignatures() must be implemented by subclass.');
  }
}

module.exports = BasePlatformPackager;
