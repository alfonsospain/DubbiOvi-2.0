# Piper 1.6.0 Local Neural TTS Engine Provenance Record

This provenance document details the source metadata, binary hashes, and packaging specifications associated with the production Piper binary runtime distributed with DubbiOvi.

## Production Runtime Metadata & Checksums

- **Component Name**: Piper Local Neural TTS Engine
- **Internal Version**: 1.6.0
- **Upstream Project**: `OHF-Voice/piper1-gpl`
- **Upstream Tag**: `v1.6.0` (Commit SHA: `f04d52c5528ac7cf2d73757f57990ff490f75005`)
- **Upstream License**: GPL v3.0 or later (`GPL-3.0-or-later`)
- **Packaged Runtime Format**: PyInstaller standalone executable bundle
- **Runtime Environment**: Python 3.9
- **Production Binary Path**: `bin/piper` (or `scratch/piper-e2e/bin/piper`)
- **Verified Production Binary SHA-256 Hashes**:
  - Production `bin/piper`: `737c5e385d3ae19f3114a100bd7f29f9c58ff5b89258ca24186ed7bea864111f`
  - E2E Test Staging `scratch/piper-e2e/bin/piper`: `a587271068d24741a0858d6a7f32dc295034b546a413330fc932c83e0a3fc6ea`

## Packaging Specification Provenance Status

- **Packaging Specification**: `piper.spec` (PyInstaller specification preserved from the DubbiOvi Piper 1.6.0 packaging workspace; exact single-build linkage to the distributed production binary could not be independently re-verified).
