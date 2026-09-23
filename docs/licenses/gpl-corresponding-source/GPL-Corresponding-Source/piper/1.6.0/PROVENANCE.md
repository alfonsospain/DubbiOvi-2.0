# Piper 1.6.0 Local Neural TTS Engine Provenance Record

This provenance document details the source metadata, binary hashes, and packaging specifications associated with the production Piper binary runtime distributed with DubbiOvi.

## Production Runtime Metadata & Checksums

- **Component Name**: Piper Local Neural TTS Engine
- **Piper Software Version**: 1.6.0
- **DubbiOvi Runtime Package Version**: 1.0.0
- **Upstream Project**: `OHF-Voice/piper1-gpl`
- **Upstream Tag**: `v1.6.0` (Commit SHA: `f04d52c5528ac7cf2d73757f57990ff490f75005`)
- **Upstream Source Archive SHA-256**: `171e27d9f5dc38048552155909f5760f781c08958e6208ea4b5d97525e1ad82b`
- **Upstream License**: GPL v3.0 or later (`GPL-3.0-or-later`)
- **Packaged Runtime Format**: PyInstaller standalone executable bundle
- **Runtime Environment**: Python 3.9
- **Production Binary Path**: `bin/piper` (or `scratch/piper-e2e/bin/piper`)
- **Verified Production Checksums**:
  - Production Runtime Archive (`piper-darwin_arm64.zip`): `88d9a643f26464d8131975d85e99e9496dbe07ff2c908550c9fc28ad9ba33c61`
  - Production `bin/piper`: `737c5e385d3ae19f3114a100bd7f29f9c58ff5b89258ca24186ed7bea864111f`
  - E2E Test Staging `scratch/piper-e2e/bin/piper`: `a587271068d24741a0858d6a7f32dc295034b546a413330fc932c83e0a3fc6ea`

## Packaging Specification Provenance Status

- **Packaging Specification**: PyInstaller specification (`piper.spec`) was generated directly by PyInstaller 6.21.0 during the production build of `piper-darwin_arm64.zip` on 27 July 2026, from the virtual environment workspace `.build_piper_darwin_arm64_1785110063`. The resulting production runtime archive has SHA-256 `88d9a643f26464d8131975d85e99e9496dbe07ff2c908550c9fc28ad9ba33c61`, and the distributed `bin/piper` executable has SHA-256 `737c5e385d3ae19f3114a100bd7f29f9c58ff5b89258ca24186ed7bea864111f`.
- **Reproducibility Note**: Historical build provenance is verified. Rebuilding with PyInstaller, codesign, and zip may not produce byte-for-byte identical archives due to archive timestamps, signature entropy, and compiler metadata.
