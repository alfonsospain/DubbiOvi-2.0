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
    id,
    name,
    category,
    version,
    executable,
    platform,
    arch,
    files,
    checksumSha256,
    minimumDubbiOviVersion = DEFAULT_MIN_DUBBIOVI_VERSION,
  } = options;

  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    minimumDubbiOviVersion,
    id,
    name,
    category,
    version,
    executable,
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
