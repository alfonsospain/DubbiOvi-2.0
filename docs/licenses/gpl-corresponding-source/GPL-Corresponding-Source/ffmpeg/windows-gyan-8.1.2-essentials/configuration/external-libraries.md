# External Libraries Inventory — Windows / gyan.dev FFmpeg 8.1.2 Essentials Build

This document inventories all external non-system libraries enabled in the Windows FFmpeg 8.1.2 Essentials static binary build (`8.1.2-essentials_build-www.gyan.dev`) distributed with DubbiOvi.

> **Verification Policy**: Provider metadata in `README.txt` publishes release version strings and commit hashes for external libraries. Verified exact upstream source code archives corresponding to 27 libraries are included in `sources/external-libraries/`. Unresolved dependency versions (including libraries whose exact upstream tag/tarball mapping could not be independently fetched from upstream) are documented transparently rather than guessed.

---

## Verified External Libraries (Included in `sources/external-libraries/`)

| Library Name | Provider Exact Version / Commit | License | Upstream Source Location | Status |
|---|---|---|---|---|
| **AMF** | `v1.5.2-1-g6ec0295` | MIT | https://github.com/GPUOpen-LibrariesAndSDKs/AMF/archive/6ec0295.tar.gz | Verified & Included |
| **aom (`libaom`)** | `v3.14.1-100-gb973895c4c` | BSD-2-Clause | https://aomedia.googlesource.com/aom/+archive/b973895c4c.tar.gz | Verified & Included |
| **AviSynthPlus** | `v3.7.5-337-gfcb9c8a2` | GPL-2.0-or-later | https://github.com/AviSynth/AviSynthPlus/archive/fcb9c8a.tar.gz | Verified & Included |
| **ffnvcodec** | `n13.0.19.0-5-g1b5a81a` | MIT | https://github.com/FFmpeg/nv-codec-headers/archive/1b5a81a.tar.gz | Verified & Included |
| **gsm (`libgsm`)** | `1.0.24` | MIT-style | http://www.quut.com/gsm/gsm-1.0.24.tar.gz | Verified & Included |
| **lame (`libmp3lame`)** | `3.100` | LGPL-2.0-or-later | https://sourceforge.net/projects/lame/files/lame/3.100/lame-3.100.tar.gz | Verified & Included |
| **libssh** | `0.12.0` | LGPL-2.1-or-later | https://www.libssh.org/files/0.12/libssh-0.12.0.tar.xz | Verified & Included |
| **libtheora** | `v1.2.0` | BSD-3-Clause | https://downloads.xiph.org/releases/theora/libtheora-1.2.0.tar.gz | Verified & Included |
| **libwebp** | `v1.6.0-192-g3757b8a` | BSD-3-Clause | https://chromium.googlesource.com/webm/libwebp/+archive/3757b8a.tar.gz | Verified & Included |
| **libopencore-amrnb** | `0.1.6` | Apache-2.0 | https://sourceforge.net/projects/opencore-amr/files/opencore-amr/opencore-amr-0.1.6.tar.gz | Verified & Included |
| **libopencore-amrwb** | `0.1.6` | Apache-2.0 | https://sourceforge.net/projects/opencore-amr/files/opencore-amr/opencore-amr-0.1.6.tar.gz | Verified & Included |
| **openmpt (`libopenmpt`)** | `libopenmpt-0.6.28-25-g1d77fab8` | BSD-3-Clause | https://github.com/OpenMPT/openmpt/archive/1d77fab8.tar.gz | Verified & Included |
| **opus (`libopus`)** | `v1.6.1-50-g3da9f7a6` | BSD-3-Clause | https://gitlab.xiph.org/xiph/opus/-/archive/3da9f7a6/opus-3da9f7a6.tar.gz | Verified & Included |
| **rubberband (`librubberband`)** | `v1.8.1` | GPL-2.0-or-later | https://breakfastquay.com/files/releases/rubberband-1.8.1.tar.bz2 | Verified & Included |
| **SDL (`sdl2`)** | `release-2.32.0-218-gb8b3f5ef2` | zlib License | https://github.com/libsdl-org/SDL/archive/b8b3f5ef2.tar.gz | Verified & Included |
| **speex (`libspeex`)** | `Speex-1.2.1-51-g0589522` | BSD-3-Clause | https://gitlab.xiph.org/xiph/speex/-/archive/0589522/speex-0589522.tar.gz | Verified & Included |
| **srt (`libsrt`)** | `v1.5.5-9-gc39196c` | MPL-2.0 | https://github.com/Haivision/srt/archive/c39196c.tar.gz | Verified & Included |
| **VAAPI** | `2.24.0` | MIT | https://github.com/intel/libva/archive/refs/tags/2.24.0.tar.gz | Verified & Included |
| **vidstab (`libvidstab`)** | `v1.1.1-24-g92bc0b0` | GPL-2.0-or-later | https://github.com/georgmartius/vid.stab/archive/92bc0b0.tar.gz | Verified & Included |
| **vmaf (`libvmaf`)** | `v3.2.0-2-g60016fbd` | BSD-2-Clause-Patent | https://github.com/netflix/vmaf/archive/60016fbd.tar.gz | Verified & Included |
| **vo-amrwbenc** | `0.1.3` | Apache-2.0 | https://sourceforge.net/projects/opencore-amr/files/vo-amrwbenc/vo-amrwbenc-0.1.3.tar.gz | Verified & Included |
| **vorbis (`libvorbis`)** | `v1.3.7-36-ge3c9861f` | BSD-3-Clause | https://gitlab.xiph.org/xiph/vorbis/-/archive/e3c9861f/vorbis-e3c9861f.tar.gz | Verified & Included |
| **VPL** | `2.16` | MIT | https://github.com/oneapi-src/oneVPL/archive/refs/tags/v2.16.0.tar.gz | Verified & Included |
| **vpx (`libvpx`)** | `v1.16.0-152-g91bba32d5` | BSD-3-Clause | https://github.com/webmproject/libvpx/archive/91bba32d5.tar.gz | Verified & Included |
| **x265 (`libx265`)** | `4.2-59-gb81f650` | GPL-2.0-or-later | https://bitbucket.org/multicoreware/x265_git/get/b81f650.tar.gz | Verified & Included |
| **xvid (`libxvid`)** | `v1.3.7` | GPL-2.0-or-later | https://downloads.xvid.com/downloads/xvidcore-1.3.7.tar.gz | Verified & Included |
| **zeromq (`libzmq`)** | `4.3.5` | MPL-2.0 / LGPL-3.0 | https://github.com/zeromq/libzmq/releases/download/v4.3.5/zeromq-4.3.5.tar.gz | Verified & Included |
| **zimg (`libzimg`)** | `release-3.0.6-222-gb364757` | WTFPL / zlib | https://github.com/sekrit-twc/zimg/archive/b364757.tar.gz | Verified & Included |

---

## Unresolved Windows Dependencies

The following enabled libraries were omitted from the provider's sub-version manifest or their exact tag/release mapping could not be independently fetched from upstream, and are disclosed as **Unresolved**:
- `openal-soft` *(reclassified)*
- `cairo` (`1.18.5`)
- `libgme` (`0.6.6`)
- `x264` (`v0.165.3223`)
- `fontconfig`
- `freetype` (`libfreetype`)
- `fribidi` (`libfribidi`)
- `harfbuzz` (`libharfbuzz`)
- `libass`
- `gnutls`
- `gmp`
- `bzlib`
- `lzma`
- `zlib`
- `iconv`
- `openjpeg` (`libopenjpeg`)
- `xml2` (`libxml2`)
