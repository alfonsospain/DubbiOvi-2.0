# Piper 1.6.0 Packaging & Build Instructions

This document provides build and packaging instructions for assembling the standalone Piper local neural TTS binary runtime distributed with DubbiOvi using preserved packaging materials.

## Component & Version Identification

- **Piper Software Version**: 1.6.0
- **DubbiOvi Runtime Package Version**: 1.0.0
- **Upstream Project**: `OHF-Voice/piper1-gpl` (Tag `v1.6.0`, Commit `f04d52c5528ac7cf2d73757f57990ff490f75005`)
- **Upstream Source Archive SHA-256**: `171e27d9f5dc38048552155909f5760f781c08958e6208ea4b5d97525e1ad82b`

## Environment & Build Requirements

- **Python Version**: Python 3.9
- **Core Dependencies**:
  - `piper-tts` (v1.6.0)
  - `onnxruntime`
  - `PyInstaller` (v6.21.0)
- **Packaging Specification**: PyInstaller specification (`piper.spec`) was generated directly by PyInstaller 6.21.0 during the production build of `piper-darwin_arm64.zip` on 27 July 2026, from the virtual environment workspace `.build_piper_darwin_arm64_1785110063`. The resulting production runtime archive has SHA-256 `88d9a643f26464d8131975d85e99e9496dbe07ff2c908550c9fc28ad9ba33c61`, and the distributed `bin/piper` executable has SHA-256 `737c5e385d3ae19f3114a100bd7f29f9c58ff5b89258ca24186ed7bea864111f`.
- **Reproducibility Note**: Historical build provenance is verified. Rebuilding with PyInstaller, codesign, and zip may not produce byte-for-byte identical archives due to archive timestamps, signature entropy, and compiler metadata.

## Packaging Workflow

1. **Virtual Environment Setup**:
   ```bash
   python3.9 -m venv .venv
   source .venv/bin/activate
   pip install --upgrade pip setuptools wheel
   ```

2. **Install Upstream Source & Dependencies**:
   ```bash
   tar -xzf ../../sources/piper/piper1-gpl-1.6.0.tar.gz
   cd piper1-gpl-1.6.0
   pip install -e .
   pip install pyinstaller onnxruntime
   ```

3. **Assemble PyInstaller Standalone Executable**:
   Using the project's preserved `piper.spec` definition:
   ```bash
   pyinstaller piper.spec
   ```
   The compiled standalone binary output is located in `dist/piper/`.

---

## Report on Legacy Shell Script (`scripts/build-piper-runtime.sh`)

During the audit of repository build materials, a legacy shell script was identified at `scripts/build-piper-runtime.sh`.

- **Script Target**: Downloads pre-compiled C++ binaries from `https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_macos_aarch64.tar.gz` (the legacy MIT-licensed `rhasspy/piper` release).
- **Status & Notice**: This legacy script is obsolete and is **not** used to build or package DubbiOvi's production Piper runtime (which uses the GPL-3.0-or-later `OHF-Voice/piper1-gpl` 1.6.0 runtime). The script remains unmodified in the repository for historical reference and was not executed during this compliance process.
