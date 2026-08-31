# Windows / gyan.dev FFmpeg 8.1.2 Essentials Provenance Record

This provenance document details the source materials, binary hashes, build configuration, maintainer statements, and downstream modification coverage for the Windows FFmpeg static binaries distributed with DubbiOvi.

## Binary Metadata & Checksums

- **Binary Distribution Files**: `bin/ffmpeg.exe`, `bin/ffprobe.exe`
- **Binary Provider**: Gyan Doshi (`gyan.dev`)
- **FFmpeg Release Version**: `8.1.2-essentials_build-www.gyan.dev`
- **Binary SHA-256 Hashes**:
  - `bin/ffmpeg.exe`: `1326dde4c84ff1f96fe6b8916c5bed29e163e9b5dccf995f6f3db069d143ec5e`
  - `bin/ffprobe.exe`: `b49ccc7c6547b141ad5a2f6ec69cc04323d7133d7704d70b331b904c63eecb07`

## Provider Statements & Patch Declarations

Upon direct inquiry regarding the build provenance and corresponding source materials for the Windows binary distribution, maintainer Gyan Doshi explicitly confirmed:

1. **Build Scripts**:
   > *"The build scripts are custom and tailored to my setup so they're not public."*

2. **Downstream Source Code Patches**:
   > *"ffmpeg and external libs are not patched."*

## Downstream Patch & Source Status

Because the binary provider confirmed that vanilla upstream FFmpeg and all compiled external libraries were built without modification, **no downstream source code patch files exist or were declared** for the `gyan.dev` FFmpeg 8.1.2 Essentials build.

Verified exact external library sources published in gyan.dev build metadata are included in `sources/external-libraries/`. Core FFmpeg source is shared at `sources/ffmpeg/ffmpeg-8.1.2.tar.xz`. Unresolved dependency versions are documented transparently rather than guessed.
