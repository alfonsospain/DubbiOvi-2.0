# macOS / Evermeet FFmpeg 8.1.2-tessus Provenance Record

This provenance document details the source materials, binary hashes, build configuration, maintainer statements, and downstream modification coverage for the macOS FFmpeg static binaries distributed with DubbiOvi.

## Binary Metadata & Checksums

- **Binary Distribution Files**: `bin/ffmpeg`, `bin/ffprobe`
- **Binary Provider**: Tessus (`evermeet.cx/ffmpeg`)
- **FFmpeg Release Version**: `8.1.2-tessus`
- **Compiler**: Apple clang version 17.0.0 (`clang-1700.6.4.2`)
- **Binary SHA-256 Hashes**:
  - `bin/ffmpeg`: `60725ea0467ccaf900bf294d3567c302a802dc661f03bdde6aa7ecc9ccf05c4f`
  - `bin/ffprobe`: `a45033d0e45ede2683cee401545becd7ef1a9873ea6f640c0acf0b90f7730b67`

## Provider Inquiry & Downstream Patch Declarations

Upon direct inquiry regarding the build provenance and corresponding source code, maintainer Tessus confirmed:

1. **Private Build Infrastructure**:
   - The custom build scripts used to create Evermeet releases are private and not publicly available.

2. **Declared Downstream Source Modifications**:
   - Tessus declared exactly two downstream source modifications applied to vanilla FFmpeg for the `8.1.2-tessus` build:
     1. A dynamic fallback setting `FONTCONFIG_PATH` to `./fonts` when unset (supplied as `ffmpeg.c.patch` and `ffmpeg.h.patch`).
     2. A version output string modification adding `https://evermeet.cx/ffmpeg/` to `fftools/opt_common.c` (supplied as reconstructed minimal diff `opt_common.c.patch`).

3. **External Library Versions**:
   - Tessus did not provide or publish an exact external-library version manifest for the `8.1.2-tessus` build; therefore, individual macOS external-library versions remain unverified and are disclosed transparently as unresolved.

## Package Summary

All provider-declared patch files, exact configuration flags, binary metadata, and vanilla FFmpeg 8.1.2 release source archives collected for this build are stored in this package structure. Core FFmpeg source is shared at `sources/ffmpeg/ffmpeg-8.1.2.tar.xz`.
