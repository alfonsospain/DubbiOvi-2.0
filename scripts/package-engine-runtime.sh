#!/usr/bin/env bash

# =============================================================================
# DubbiOvi Runtime Packager
# Generic Builder for Redistributable Local AI Engine Packages
# =============================================================================
# Works for any local engine (Whisper, Piper, Kokoro, XTTS, llama.cpp, etc.)
# Features:
#   1. Resolves dynamic library dependencies
#   2. Relocates Mach-O RPATHs to relative @executable_path (macOS)
#   3. Generates standardized DubbiOvi manifest.json
#   4. Re-signs binaries with ad-hoc codesign (Apple Silicon compatible)
#   5. Archives to ZIP and computes SHA-256 checksums for DownloadManager
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# Usage & Argument Parsing
# -----------------------------------------------------------------------------
function show_usage() {
    cat << EOF
Usage: $0 [options]

Options:
  --engine-id       Engine ID (e.g. whisper, piper, kokoro, xtts) [Required]
  --engine-name     Human-readable engine name (e.g. "Whisper.cpp Engine") [Required]
  --category        Domain category (asr, tts, llm, mt) [Required]
  --version         Engine version tag (e.g. 1.9.1) [Required]
  --exec            Primary executable filename (e.g. whisper-cli) [Required]
  --src-dir         Source build directory containing binaries & dylibs [Required]
  --out-dir         Destination output directory (default: ./dist)
  --help            Show this help message

Example:
  $0 --engine-id whisper \
     --engine-name "Whisper.cpp Engine" \
     --category asr \
     --version 1.9.1 \
     --exec whisper-cli \
     --src-dir /Volumes/AlfonsoSSD/GitHub/whisper.cpp/build/bin
EOF
    exit 1
}

ENGINE_ID=""
ENGINE_NAME=""
CATEGORY=""
VERSION=""
EXEC_NAME=""
SRC_DIR=""
OUT_DIR="./dist"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --engine-id)   ENGINE_ID="$2"; shift 2 ;;
        --engine-name) ENGINE_NAME="$2"; shift 2 ;;
        --category)    CATEGORY="$2"; shift 2 ;;
        --version)     VERSION="$2"; shift 2 ;;
        --exec)        EXEC_NAME="$2"; shift 2 ;;
        --src-dir)     SRC_DIR="$2"; shift 2 ;;
        --out-dir)     OUT_DIR="$2"; shift 2 ;;
        --help)        show_usage ;;
        *) echo "Unknown option: $1"; show_usage ;;
    esac
done

if [[ -z "${ENGINE_ID}" || -z "${ENGINE_NAME}" || -z "${CATEGORY}" || -z "${VERSION}" || -z "${EXEC_NAME}" || -z "${SRC_DIR}" ]]; then
    echo "Error: Missing required arguments."
    show_usage
fi

PLATFORM="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
if [[ "${PLATFORM}" == "darwin" && "${ARCH}" == "arm64" ]]; then
    PLATFORM_KEY="darwin_arm64"
elif [[ "${PLATFORM}" == "darwin" ]]; then
    PLATFORM_KEY="darwin_x64"
elif [[ "${PLATFORM}" == "linux" ]]; then
    PLATFORM_KEY="linux_${ARCH}"
else
    PLATFORM_KEY="${PLATFORM}_${ARCH}"
fi

PACKAGE_NAME="${ENGINE_ID}-${PLATFORM_KEY}"
STAGING_DIR="${OUT_DIR}/${PACKAGE_NAME}"
ZIP_PATH="${OUT_DIR}/${PACKAGE_NAME}.zip"

echo "=== DubbiOvi Runtime Packager ==="
echo "Engine ID     : ${ENGINE_ID}"
echo "Engine Name   : ${ENGINE_NAME}"
echo "Category      : ${CATEGORY}"
echo "Version       : ${VERSION}"
echo "Executable    : ${EXEC_NAME}"
echo "Platform Key  : ${PLATFORM_KEY}"
echo "Source Dir    : ${SRC_DIR}"
echo "Staging Dir   : ${STAGING_DIR}"
echo "================================="

# -----------------------------------------------------------------------------
# 1. Prepare Staging Directory
# -----------------------------------------------------------------------------
rm -rf "${STAGING_DIR}" "${ZIP_PATH}"
mkdir -p "${STAGING_DIR}"

EXEC_SRC="${SRC_DIR}/${EXEC_NAME}"
if [[ ! -f "${EXEC_SRC}" ]]; then
    echo "Error: Executable not found at ${EXEC_SRC}"
    exit 1
fi

cp "${EXEC_SRC}" "${STAGING_DIR}/"

# -----------------------------------------------------------------------------
# 2. Discover & Copy Required Dynamic Libraries
# -----------------------------------------------------------------------------
echo "--> Resolving dynamic library dependencies..."

if [[ "${PLATFORM}" == "darwin" ]]; then
    # Parse Mach-O dependencies pointing to build directory or local libs
    DYLIBS=$(otool -L "${EXEC_SRC}" | awk '{print $1}' | grep -E '\.dylib' | grep -v '^/usr/lib' | grep -v '^/System' || true)
    for lib_path in ${DYLIBS}; do
        lib_name="$(basename "${lib_path}")"
        if [[ -f "${SRC_DIR}/${lib_name}" ]]; then
            echo "    Including dynamic library: ${lib_name}"
            cp "${SRC_DIR}/${lib_name}" "${STAGING_DIR}/"
        elif [[ -f "${lib_path}" ]]; then
            echo "    Including dynamic library: ${lib_path}"
            cp "${lib_path}" "${STAGING_DIR}/"
        fi
    done
fi

# Fallback: copy any dylibs/so present in source directory if referenced
for lib in "${SRC_DIR}"/*.dylib "${SRC_DIR}"/*.so*; do
    if [[ -f "${lib}" ]]; then
        lib_name="$(basename "${lib}")"
        if [[ ! -f "${STAGING_DIR}/${lib_name}" ]]; then
            echo "    Including discovered library: ${lib_name}"
            cp "${lib}" "${STAGING_DIR}/"
        fi
    fi
done 2>/dev/null || true

# -----------------------------------------------------------------------------
# 3. macOS Mach-O RPATH & Linkage Fixes
# -----------------------------------------------------------------------------
if [[ "${PLATFORM}" == "darwin" ]]; then
    echo "--> Relocating Mach-O library RPATHs to @executable_path..."

    cd "${STAGING_DIR}"

    # Fix install name ID for all dylibs
    for dylib in *.dylib; do
        if [[ -f "${dylib}" ]]; then
            chmod 755 "${dylib}"
            install_name_tool -id "@rpath/${dylib}" "${dylib}" 2>/dev/null || true
        fi
    done 2>/dev/null || true

    # Clean absolute RPATHs and add @executable_path
    for binary in "${EXEC_NAME}" *.dylib; do
        if [[ -f "${binary}" ]]; then
            chmod 755 "${binary}"

            # Remove all absolute RPATH commands
            CURRENT_RPATHS=$(otool -l "${binary}" | awk '/cmd LC_RPATH/{getline; getline; print $2}')
            for rpath in ${CURRENT_RPATHS}; do
                install_name_tool -delete_rpath "${rpath}" "${binary}" 2>/dev/null || true
            done

            # Add relative RPATH
            install_name_tool -add_rpath "@executable_path" "${binary}" 2>/dev/null || true
        fi
    done 2>/dev/null || true

    # Fix inter-library dependencies to use @rpath/
    for binary in "${EXEC_NAME}" *.dylib; do
        if [[ -f "${binary}" ]]; then
            for dylib in *.dylib; do
                if [[ -f "${dylib}" ]]; then
                    OLD_REF=$(otool -L "${binary}" | grep "${dylib}" | awk '{print $1}' || true)
                    if [[ -n "${OLD_REF}" && "${OLD_REF}" != "@rpath/${dylib}" ]]; then
                        install_name_tool -change "${OLD_REF}" "@rpath/${dylib}" "${binary}" 2>/dev/null || true
                    fi
                fi
            done
        fi
    done 2>/dev/null || true

    # Ad-hoc codesign binaries for Apple Silicon compatibility
    echo "--> Signing binaries for Apple Silicon..."
    for binary in "${EXEC_NAME}" *.dylib; do
        if [[ -f "${binary}" ]]; then
            codesign --force --deep -s - "${binary}" 2>/dev/null || true
        fi
    done 2>/dev/null || true

    cd - > /dev/null
fi

# -----------------------------------------------------------------------------
# 4. Generate DubbiOvi manifest.json
# -----------------------------------------------------------------------------
echo "--> Generating DubbiOvi manifest.json..."

MANIFEST_PATH="${STAGING_DIR}/manifest.json"
PACKAGED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

FILES_JSON_ARRAY=$(cd "${STAGING_DIR}" && find . -maxdepth 1 -type f ! -name "manifest.json" | sed 's|^\./||' | jq -R . | jq -s .)

cat << EOF > "${MANIFEST_PATH}"
{
  "id": "${ENGINE_ID}",
  "name": "${ENGINE_NAME}",
  "category": "${CATEGORY}",
  "version": "${VERSION}",
  "executable": "${EXEC_NAME}",
  "platform": "${PLATFORM}",
  "arch": "${ARCH}",
  "packagedAt": "${PACKAGED_AT}",
  "files": ${FILES_JSON_ARRAY}
}
EOF

# -----------------------------------------------------------------------------
# 5. Archive Package & Compute SHA-256 Checksum
# -----------------------------------------------------------------------------
echo "--> Creating final ZIP archive: ${ZIP_PATH}"
cd "${OUT_DIR}"
zip -q -r "$(basename "${ZIP_PATH}")" "$(basename "${STAGING_DIR}")"
cd - > /dev/null

SHA256_HASH=$(shasum -a 256 "${ZIP_PATH}" | awk '{print $1}')
echo "${SHA256_HASH}  $(basename "${ZIP_PATH}")" > "${ZIP_PATH}.sha256"

echo "================================================================="
echo " SUCCESS: Runtime package created successfully!"
echo " Package Archive : ${ZIP_PATH}"
echo " SHA-256 Hash    : ${SHA256_HASH}"
echo " Checksum File   : ${ZIP_PATH}.sha256"
echo "================================================================="
