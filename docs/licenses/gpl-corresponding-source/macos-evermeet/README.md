# macOS / Evermeet FFmpeg 8.1.2-tessus Patch Set Documentation

This directory contains downstream source code modifications declared by the Evermeet build provider (Tessus) for the macOS FFmpeg build (`8.1.2-tessus`) distributed with DubbiOvi.

## Patch Breakdown

1. **`ffmpeg.c.patch` & `ffmpeg.h.patch`** (Original files as supplied by Tessus)
   - **Target Files**: `fftools/ffmpeg.c` and `fftools/ffmpeg.h`
   - **Functionality**: Implements `set_relative_fontconfig_path()`, which checks if `FONTCONFIG_PATH` is set in the environment. If unset, it dynamically sets `FONTCONFIG_PATH` to `./fonts` relative to the current working directory. The function is invoked at entry of `main()` when `CONFIG_STATIC` is defined.

2. **`opt_common.c.patch`** (Reconstructed minimal unified diff)
   - **Target File**: `fftools/opt_common.c`
   - **Functionality**: Modifies the output of `print_program_info()` (invoked via `ffmpeg -version` or banner display) to insert `https://evermeet.cx/ffmpeg/` before the copyright notice. This reflects the maintainer's sed transformation:
     `sed 's/Copyright (c) %d/ https:\/\/evermeet.cx\/ffmpeg\/ Copyright (c) %d/' fftools/opt_common.c`

## Declarations & Coverage

The maintainer of Evermeet (Tessus) confirmed that these two items—the `FONTCONFIG_PATH` relative directory resolution and the `evermeet.cx` version banner branding—constitute the only downstream source modifications applied to vanilla FFmpeg for the `8.1.2-tessus` build.

*Note: These patch files are provided strictly for source compliance and documentation. They are not applied to the DubbiOvi application runtime.*
