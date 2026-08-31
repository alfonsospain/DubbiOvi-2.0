# Transparency Note — GPL Corresponding Source Package

This transparency note accompanies the source and compliance distribution package for third-party binaries included with DubbiOvi (specifically FFmpeg, ffprobe, and Piper).

## Background & Due Diligence

DubbiOvi distributes pre-compiled FFmpeg binaries sourced from third-party binary packagers:
- **macOS binaries**: Sourced from Evermeet (`evermeet.cx/ffmpeg`, maintained by Tessus).
- **Windows binaries**: Sourced from gyan.dev (`gyan.dev/ffmpeg`, maintained by Gyan Doshi).

In preparing the Corresponding Source documentation for this release, the DubbiOvi maintainers contacted both binary packagers directly to request complete build scripts, source configurations, and any applied patch files.

## Summary of Responses & Collected Materials

1. **Private Build Scripts**:
   - Both binary providers (Evermeet and gyan.dev) confirmed that their build environments and build scripts are private, customized to their individual infrastructure, and not publicly available.

2. **Windows (gyan.dev) Patch Status**:
   - Maintainer Gyan Doshi confirmed that no downstream patches were applied to FFmpeg or external libraries for the Windows 8.1.2 Essentials build ("ffmpeg and external libs are not patched").
   - Verified exact external library sources published in gyan.dev metadata are included in `sources/external-libraries/`. Unresolved dependency versions are documented transparently rather than guessed.

3. **macOS (Evermeet) Patch Status**:
   - Maintainer Tessus confirmed two downstream source modifications for the macOS 8.1.2-tessus build:
     1. A dynamic fallback setting `FONTCONFIG_PATH` to `./fonts` when unset (represented in `ffmpeg.c.patch` and `ffmpeg.h.patch`).
     2. A version-banner string addition inserting `https://evermeet.cx/ffmpeg/` into `opt_common.c` (represented in `opt_common.c.patch`).
   - Packager Tessus did not publish an external-library version manifest for the 8.1.2-tessus build; therefore, individual macOS external-library versions remain classified as unresolved and are disclosed transparently without version guessing.

## Package Scope & Material Availability

The final Corresponding Source package is intended to include all known available source code, configuration details, build parameters, and patch files collected by the DubbiOvi project from the relevant upstream projects and third-party binary providers.

Once assembled, the package contains the most complete source, configuration, and patch material available to the DubbiOvi project as of the release date.
