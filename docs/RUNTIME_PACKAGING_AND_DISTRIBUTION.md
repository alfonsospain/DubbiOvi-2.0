# DubbiOvi 2.0 — Cross-Platform Runtime Packaging & Distribution Architecture

This document specifies the technical architecture for packaging, versioning, distributing, and installing local AI runtime engines (such as Whisper, Piper, Kokoro, XTTS, llama.cpp, and FFmpeg) in DubbiOvi 2.0.

---

## 1. Overview & Architecture

DubbiOvi 2.0 uses a **decoupled, modular runtime architecture**. Runtime binary engines and AI model files (e.g., ggml `.bin` models) are packaged and distributed **completely independently**:

- **Runtime Packages**: Contain strictly binary executables (`bin/whisper-cli` or `bin/whisper-cli.exe`), dynamic library dependencies (`.dylib`, `.dll`, `.so`), `LICENSE`, `VERSION`, and `manifest.json`. **No AI model files are ever bundled in runtime packages.**
- **Model Files**: Downloaded separately on demand into user data storage.

```
+-----------------------------------------------------------------------+
|                 DubbiOvi Local AI Engine Ecosystem                     |
+-----------------------------------------------------------------------+
|  Runtime Engine Release Archive (.zip)  |      AI Model Files (.bin)   |
|  - bin/whisper-cli (or whisper-cli.exe)|      - ggml-tiny.bin          |
|  - manifest.json                        |      - ggml-base.bin          |
|  - LICENSE / VERSION                    |      - ggml-small.bin         |
+-----------------------------------------+-----------------------------+
```

---

## 2. Generating Runtime Packages

Runtime packages are created using the reproducible single-command CLI builder: `node scripts/package-runtimes.js` (or `npm run package:runtime`).

### Single-Command Usage

```bash
# Package Whisper engine for current platform:
npm run package:runtime -- --engine whisper --version 1.9.1 --exec whisper-cli --src ./dist/whisper-darwin_arm64/bin

# Package for specific platform target:
node scripts/package-runtimes.js \
  --engine whisper \
  --name "Whisper.cpp Engine" \
  --category asr \
  --version 1.9.1 \
  --exec whisper-cli \
  --src ./build/bin \
  --out ./dist \
  --platform darwin_arm64
```

### CLI Arguments

| Argument | Description | Default |
| :--- | :--- | :--- |
| `--engine` / `--engine-id` | Unique ID of the engine (e.g. `whisper`, `piper`, `llama`) | `whisper` |
| `--name` / `--engine-name` | Human-readable name | `"Whisper.cpp Engine"` |
| `--category` | Domain category: `asr`, `tts`, `llm`, `mt` | `asr` |
| `--version` | Engine version tag (e.g. `1.9.1`) | `1.9.1` |
| `--exec` / `--binary` | Primary executable name (`whisper-cli`) | `whisper-cli` |
| `--src` / `--src-dir` | Directory containing compiled binaries & libraries | Auto-resolved |
| `--out` / `--out-dir` | Output directory for `.zip` and `.sha256` files | `./dist` |
| `--platform` | Target platform: `darwin_arm64`, `darwin_x64`, `win32_x64`, `linux_x64` | Current platform |

### Generated Output Assets

The packager produces platform-specific archives named strictly according to the format `${engineId}-${platform}_${arch}.zip`:

- `whisper-darwin_arm64.zip` (macOS Apple Silicon)
- `whisper-darwin_x64.zip` (macOS Intel)
- `whisper-win32_x64.zip` (Windows 64-bit)
- `whisper-linux_x64.zip` (Linux 64-bit)

Alongside each archive, a SHA-256 hash file is generated (e.g. `whisper-darwin_arm64.zip.sha256`).

---

## 3. Archive Structure & `manifest.json` Schema v2.0.0

Each `.zip` package contains the following root structure:

```
whisper-darwin_arm64.zip
├── bin/
│   └── whisper-cli
└── manifest.json
```

### `manifest.json` Specifications

```json
{
  "manifestVersion": "2.0.0",
  "runtimeApiVersion": "2.0.0",
  "schemaVersion": "2.0.0",
  "minimumDubbiOviVersion": "2.0.0",
  "id": "whisper",
  "engine": "whisper",
  "name": "Whisper.cpp Engine",
  "category": "asr",
  "version": "1.9.1",
  "executable": "bin/whisper-cli",
  "binary": "bin/whisper-cli",
  "platform": "darwin",
  "arch": "arm64",
  "packagedAt": "2026-07-25T12:00:00.000Z",
  "files": [
    "bin/whisper-cli"
  ],
  "checksumSha256": "f50579a24e618b40dbe318594edbd374fd954d8a488f70086429d8126d18d7b2"
}
```

### Protocol Decoupling & Versioning Fields

To allow package specifications and installation protocols to evolve independently without breaking legacy installations, `manifest.json` includes two explicit versioning fields:

1. **`manifestVersion`**: Specifies the schema version of the `manifest.json` metadata format.
2. **`runtimeApiVersion`**: Specifies the minimum Runtime Execution Framework protocol version supported by the package.

---

## 4. Distribution via GitHub Releases

Runtime packages are uploaded to designated GitHub Release tags on the DubbiOvi repository:

- **Release Tag**: `v2.0.0-runtimes`
- **Release URL Base**: `https://github.com/alfonsospain/DubbiOvi-2.0/releases/download/v2.0.0-runtimes/`

### Direct Asset Upload Mapping

| Asset Name | Target Environment |
| :--- | :--- |
| `whisper-darwin_arm64.zip` | macOS Apple Silicon (M1/M2/M3/M4) |
| `whisper-darwin_x64.zip` | macOS Intel 64-bit |
| `whisper-win32_x64.zip` | Windows 64-bit |
| `whisper-linux_x64.zip` | Linux 64-bit |

---

## 5. Automated Asset Resolution in `RuntimeInstaller`

`RuntimeRepository` centralizes operating system and architecture resolution using standard Node.js process identifiers (`process.platform` and `process.arch`):

```ts
// Centralized resolution in RuntimeRepository
const platformKey = RuntimeRepository.resolvePlatformKey(process.platform, process.arch);
// => "darwin_arm64" (on macOS Apple Silicon)
// => "win32_x64" (on Windows 64-bit)

const releaseFilename = RuntimeRepository.resolveReleaseFilename("whisper", process.platform, process.arch);
// => "whisper-darwin_arm64.zip"
```

### Resolution & Atomic Installation Workflow

```
1. Provider requests installation (ensureRuntimeInstalled)
        │
        ▼
2. RuntimeRepository resolves release URL for current platform/arch
        │
        ▼
3. RuntimeDownloader fetches .zip archive & verifies SHA-256 checksum
        │
        ▼
4. RuntimeInstaller extracts .zip into staging directory (.staging/whisper)
        │
        ▼
5. RuntimeValidator checks for path traversal vulnerabilities & validates manifest.json
        │
        ▼
6. RuntimeInstaller atomically promotes staging directory to final target (~/runtimes/whisper/1.9.1/)
        │
        ▼
7. RuntimeRegistry updates local registry record (status: INSTALLED)
```

---

## 6. Extending for Future Local AI Engines

The Runtime Packaging Pipeline is designed as generic infrastructure. To add a new local AI engine (e.g., **Piper TTS**, **Ollama**, or **FFmpeg**):

1. **Compile / Obtain Binaries**: Build or download compiled platform binaries for the target engine.
2. **Execute Packager**:
   ```bash
   node scripts/package-runtimes.js \
     --engine piper \
     --name "Piper Neural TTS" \
     --category tts \
     --version 1.2.0 \
     --exec piper \
     --src ./build/piper/bin \
     --platform darwin_arm64
   ```
3. **Register Descriptor in `RuntimeRepository`**:
   Add the catalog descriptor entry in `RuntimeRepository.ts`:
   ```ts
   const piperMacArm64: RuntimeDescriptor = {
     id: 'piper',
     name: 'Piper Neural TTS',
     category: 'tts',
     version: '1.2.0',
     downloadUrl: 'https://github.com/alfonsospain/DubbiOvi-2.0/releases/download/v2.0.0-runtimes/piper-darwin_arm64.zip',
     checksumSha256: '...',
     runtimeApiVersion: '2.0.0',
     minimumDubbiOviVersion: '2.0.0',
   };
   this.registerDescriptor(piperMacArm64, 'darwin', 'arm64');
   ```

No modifications to `RuntimeInstaller`, `RuntimeExecutor`, or `RuntimeProcess` are required.
