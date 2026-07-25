/**
 * DubbiOvi Runtime Package Specification & Manifest Schema v2.0.0
 */

const MANIFEST_SCHEMA_VERSION = '2.0.0';
const DEFAULT_MIN_DUBBIOVI_VERSION = '2.0.0';

/**
 * Creates a standardized DubbiOvi Runtime Manifest object.
 *
 * @param {Object} options Options for manifest generation.
 * @returns {Object} Manifest JSON payload.
 */
function createRuntimeManifest(options) {
  const {
    id = options.engineId || options.engine,
    name = options.engineName,
    category,
    version,
    executable = options.binary,
    platform,
    arch,
    files,
    checksumSha256,
    manifestVersion = '2.0.0',
    runtimeApiVersion = '2.0.0',
    minimumDubbiOviVersion = DEFAULT_MIN_DUBBIOVI_VERSION,
  } = options;

  const resolvedEngine = id || options.engine || 'whisper';
  const resolvedExecutable = executable || options.binary || 'bin/whisper-cli';

  return {
    manifestVersion,
    runtimeApiVersion,
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    minimumDubbiOviVersion,
    id: resolvedEngine,
    engine: resolvedEngine,
    name,
    category,
    version,
    executable: resolvedExecutable,
    binary: resolvedExecutable,
    platform,
    arch,
    packagedAt: new Date().toISOString(),
    files: files || [],
    checksumSha256: checksumSha256 || null,
  };
}

module.exports = {
  MANIFEST_SCHEMA_VERSION,
  DEFAULT_MIN_DUBBIOVI_VERSION,
  createRuntimeManifest,
};
