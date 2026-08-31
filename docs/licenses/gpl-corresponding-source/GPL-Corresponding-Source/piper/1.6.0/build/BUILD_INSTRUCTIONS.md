# Piper 1.6.0 Packaging & Build Instructions

This document provides build and packaging instructions for assembling the standalone Piper 1.6.0 local neural TTS binary runtime distributed with DubbiOvi using preserved packaging materials.

## Environment & Build Requirements

- **Python Version**: Python 3.9
- **Core Dependencies**:
  - `piper-tts` (v1.6.0)
  - `onnxruntime`
  - `PyInstaller` (v6.x)
- **Packaging Specification**: `piper.spec` (PyInstaller specification preserved from the DubbiOvi Piper 1.6.0 packaging workspace; exact single-build linkage to the distributed production binary could not be independently re-verified).

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
