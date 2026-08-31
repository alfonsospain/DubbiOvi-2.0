# DubbiOvi 2.0 — GPL Corresponding Source Materials

This package contains source code, patch files, build specifications, configuration details, and provenance records collected for third-party binary components distributed with DubbiOvi 2.0.

## Component Index

### 1. Source Code Archives (`sources/`)
- `sources/ffmpeg/`: Vanilla FFmpeg 8.1.2 release source archive (`ffmpeg-8.1.2.tar.xz`).
- `sources/piper/`: Upstream `OHF-Voice/piper1-gpl` tag `v1.6.0` release source archive (`piper1-gpl-1.6.0.tar.gz`).
- `sources/external-libraries/`: Verified exact upstream source code archives for statically incorporated external components.

### 2. FFmpeg — macOS / Evermeet 8.1.2-tessus (`ffmpeg/macos-evermeet-8.1.2/`)
- `patches/`: Original Tessus patches (`ffmpeg.c.patch`, `ffmpeg.h.patch`) and reconstructed version banner patch (`opt_common.c.patch`).
- `configuration/`: Exact build configuration flags, binary version output, and external library inventory.
- `PROVENANCE.md`: Build provenance and packager due diligence record.

### 3. FFmpeg — Windows / gyan.dev 8.1.2 Essentials (`ffmpeg/windows-gyan-8.1.2-essentials/`)
- `configuration/`: Exact build configuration flags, binary version output, and external library inventory.
- `PROVENANCE.md`: Build provenance and packager declaration confirming zero downstream patches.

### 4. Piper Local Neural TTS Engine v1.6.0 (`piper/1.6.0/`)
- `build/`: PyInstaller specification (`piper.spec`) and build instructions.
- `PROVENANCE.md`: Production runtime binary hashes, git tag `v1.6.0` (commit `f04d52c5528ac7cf2d73757f57990ff490f75005`), and packaging metadata.

## Additional Documentation

- `TRANSPARENCY_NOTE.md`: Public disclosure detailing maintainer inquiries, private build script status, and package material scope.
- `MANIFEST-SHA256.txt`: SHA-256 checksum manifest for all files included in this package.
