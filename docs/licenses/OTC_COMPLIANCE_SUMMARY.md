# Summary of Third-Party Compliance & GPL Corresponding Source — DubbiOvi 2.0

This summary details the third-party open-source compliance status, architecture, provider due-diligence results, and GPL Corresponding Source distribution mechanism for **DubbiOvi 2.0** prepared for the Office of Technology Transfer (OTC) of the University of Oviedo.

---

## 1. Compliance Architecture Overview

DubbiOvi 2.0 incorporates open-source third-party components under three distinct integration models:

1. **Permissive Open-Source Libraries (MIT, Apache-2.0, ISC, BSD)**:
   - Frameworks (Electron 31.7.7, Next.js 15.3.8, React 18.3.1) and Node.js npm packages are governed by permissive open-source licenses. Full machine-readable inventories are maintained at `docs/licenses/npm-licenses.json` and `docs/licenses/npm-licenses.csv`.
   - **Sharp (v0.33.4)** is a build-time development tool (`devDependency`) used for icon generation; Sharp and libvips native binaries are explicitly excluded from packaged application distributions via `electron-builder.json5`. Direct inspection of the inspected macOS .app and DMG found no Sharp, @img, libvips, native Sharp .node, or related .dylib files. Final artifact verification for Windows remains pending until a packaged Windows executable artifact is available.

2. **Isolated Subprocess Executables (FFmpeg 8.1.2 & Piper 1.6.0)**:
   - Third-party GPL binaries are integrated exclusively as standalone external executables invoked via Node.js `child_process.spawn`.
   - No static linking, dynamic library loading (`.dylib`, `.dll`, `.so`), shared memory IPC, or language bindings exist between DubbiOvi application code and GPL component libraries.

3. **GPL Corresponding Source Release-Asset Delivery (GPL-3.0 Section 6 / Artículo 6 de la GPL-3.0)**:
   - Source-compliance materials for distributed GPL components are collected into a separate source release asset (`DubbiOvi-2.0.0-GPL-Corresponding-Source.tar.xz`).
   - The asset is distributed independently alongside application binaries and is maintained outside normal application Git history.

---

## 2. Component Provenance & Provider Due Diligence

### A. FFmpeg / FFprobe (v8.1.2)
- **License**: `GPL-3.0-or-later` (compiled with `--enable-gpl --enable-version3`).
- **macOS Binaries Provider**: Evermeet (`evermeet.cx`, maintained by Tessus).
  - *Due Diligence Result*: Maintainer confirmed build scripts are private. Historical build metadata for external libraries is maintained and publicly available via the Evermeet info API (`https://evermeet.cx/ffmpeg/info/ffmpeg/8.1.2`). Tessus confirmed two downstream source modifications (`FONTCONFIG_PATH` fallback in `ffmpeg.c/h` and version string banner in `fftools/opt_common.c`), both represented as patch files in the technical source materials, and directly confirmed `libxml2 2.11.5`.
- **Windows Binaries Provider**: gyan.dev (`gyan.dev`, maintained by Gyan Doshi).
  - *Due Diligence Result*: Maintainer confirmed custom build scripts are private and that no downstream patches are applied to FFmpeg or its external libraries. Empirically verified external library source archives are included in the source materials.

### B. Piper Neural TTS Engine (v1.6.0)
- **License**: `GPL-3.0-or-later` (Upstream `OHF-Voice/piper1-gpl`).
- **Tag & Commit**: Tag `v1.6.0` (Commit SHA: `f04d52c5528ac7cf2d73757f57990ff490f75005`).
- **Packaging Specification Provenance**: PyInstaller specification (`piper.spec`) preserved from the DubbiOvi Piper 1.6.0 packaging workspace; exact single-build linkage to the distributed production binary could not be independently re-verified.

---

## 3. Corresponding Source Release Asset Specification

- **Release Asset Filename**: `DubbiOvi-2.0.0-GPL-Corresponding-Source.tar.xz`
- **Local Staging Path**: `/Users/alfonso/Documents/DubbiOvi-2.0-OTC-Internal/GPL-Release-Asset-Staging/DubbiOvi-2.0.0-GPL-Corresponding-Source.tar.xz`
- **Exact File Byte Size**: `538,275,504 bytes` (538.28 MB)
- **Authoritative SHA-256 Hash**:
  ```text
  58d25ffb9be91bc144fc0de3f34032625ab715035234bc3685bce786b91a5e8b
  ```
- **Asset Contents**:
  - Vanilla FFmpeg 8.1.2 source archive (`ffmpeg-8.1.2.tar.xz`)
  - Upstream Piper 1.6.0 release source archive (`piper1-gpl-1.6.0.tar.gz`)
  - 27 verified exact external library source archives
  - Evermeet patch files (`ffmpeg.c.patch`, `ffmpeg.h.patch`, `opt_common.c.patch`)
  - Preserved `piper.spec` PyInstaller specification & build instructions
  - Complete SHA-256 checksum manifest (`MANIFEST-SHA256.txt`)
  - Provenance records and transparency notes

---

## 4. Institutional Notice & Integrity Confirmation

- **Functional Code Integrity**: No DubbiOvi application source code, FFmpeg/ffprobe binaries, Piper runtime, runtime download logic, or packaging configurations were modified during this compliance process.
- **Root Licensing Status**: Root application licensing for DubbiOvi itself remains pending final formalization by the Office of Technology Transfer (OTC) of the University of Oviedo.
