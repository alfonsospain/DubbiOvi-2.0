#!/usr/bin/env bash

# =============================================================================
# DubbiOvi Piper Local TTS Runtime Builder
# Reproducible Packaging Pipeline for Self-Contained Piper Runtime Packages
# =============================================================================

set -euo pipefail

TARGET_PLATFORM="${1:-darwin_arm64}"
VERSION="${2:-1.0.0}"
OUT_DIR="./dist"

echo "================================================================="
echo " DUBBIOVI PIPER RUNTIME BUILDER"
echo " Target Platform : ${TARGET_PLATFORM}"
echo " Runtime Version : ${VERSION}"
echo " Output Directory: ${OUT_DIR}"
echo "================================================================="

BUILD_TMP="./.build_piper_${TARGET_PLATFORM}_${Date:-$(date +%s)}"
rm -rf "${BUILD_TMP}"
mkdir -p "${BUILD_TMP}" "${OUT_DIR}"

PACKAGE_NAME="piper-${TARGET_PLATFORM}"
STAGING_DIR="${OUT_DIR}/${PACKAGE_NAME}"
ZIP_PATH="${OUT_DIR}/${PACKAGE_NAME}.zip"

rm -rf "${STAGING_DIR}" "${ZIP_PATH}" "${ZIP_PATH}.sha256"

if [[ "${TARGET_PLATFORM}" == "darwin_arm64" ]]; then
    echo "--> Downloading official standalone C++ release package for macOS arm64..."
    MAC_ARM_URL="https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_macos_aarch64.tar.gz"
    curl -s -L -o "${BUILD_TMP}/piper_mac_arm.tar.gz" "${MAC_ARM_URL}"
    mkdir -p "${BUILD_TMP}/mac_arm_extract"
    tar -xzf "${BUILD_TMP}/piper_mac_arm.tar.gz" -C "${BUILD_TMP}/mac_arm_extract"

    mkdir -p "${STAGING_DIR}/bin"
    cp -R "${BUILD_TMP}/mac_arm_extract/piper/"* "${STAGING_DIR}/bin/"
    chmod +x "${STAGING_DIR}/bin/piper"

    if [[ "$(uname -s)" == "Darwin" ]]; then
        echo "--> Applying Mach-O ad-hoc codesign to staging binaries..."
        find "${STAGING_DIR}/bin" -type f \( -name "piper" -o -name "*.dylib" -o -name "*.so" \) | while read -r binfile; do
            chmod 755 "${binfile}"
            codesign --force --deep -s - "${binfile}" 2>/dev/null || true
        done
    fi

elif [[ "${TARGET_PLATFORM}" == "darwin_x64" ]]; then
    echo "--> Downloading official standalone C++ release package for macOS x64..."
    MAC_X64_URL="https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_macos_x64.tar.gz"
    curl -s -L -o "${BUILD_TMP}/piper_mac_x64.tar.gz" "${MAC_X64_URL}"
    mkdir -p "${BUILD_TMP}/mac_x64_extract"
    tar -xzf "${BUILD_TMP}/piper_mac_x64.tar.gz" -C "${BUILD_TMP}/mac_x64_extract"

    mkdir -p "${STAGING_DIR}/bin"
    cp -R "${BUILD_TMP}/mac_x64_extract/piper/"* "${STAGING_DIR}/bin/"
    chmod +x "${STAGING_DIR}/bin/piper"

    if [[ "$(uname -s)" == "Darwin" ]]; then
        echo "--> Applying Mach-O ad-hoc codesign to staging binaries..."
        find "${STAGING_DIR}/bin" -type f \( -name "piper" -o -name "*.dylib" -o -name "*.so" \) | while read -r binfile; do
            chmod 755 "${binfile}"
            codesign --force --deep -s - "${binfile}" 2>/dev/null || true
        done
    fi

elif [[ "${TARGET_PLATFORM}" == "win32_x64" ]]; then
    echo "--> Downloading official standalone C++ release package for Windows x64..."
    WIN_URL="https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip"
    curl -s -L -o "${BUILD_TMP}/piper_win.zip" "${WIN_URL}"
    mkdir -p "${BUILD_TMP}/win_extract"
    unzip -q "${BUILD_TMP}/piper_win.zip" -d "${BUILD_TMP}/win_extract"

    mkdir -p "${STAGING_DIR}/bin"
    cp -R "${BUILD_TMP}/win_extract/piper/"* "${STAGING_DIR}/bin/"
else
    echo "Error: Unsupported target platform '${TARGET_PLATFORM}'"
    rm -rf "${BUILD_TMP}"
    exit 1
fi

# -----------------------------------------------------------------------------
# Generate DubbiOvi manifest.json
# -----------------------------------------------------------------------------
echo "--> Generating DubbiOvi manifest.json..."

PLATFORM_NAME="${TARGET_PLATFORM%%_*}"
ARCH_NAME="${TARGET_PLATFORM#*_}"
EXEC_REL_PATH="bin/piper"
if [[ "${PLATFORM_NAME}" == "win32" ]]; then
    EXEC_REL_PATH="bin/piper.exe"
fi

FILES_JSON_ARRAY=$(cd "${STAGING_DIR}" && find . -mindepth 1 ! -name "manifest.json" | sed 's|^\./||' | jq -R . | jq -s .)
PACKAGED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat << EOF > "${STAGING_DIR}/manifest.json"
{
  "schemaVersion": "2.0.0",
  "id": "piper",
  "name": "Piper Neural TTS Engine",
  "category": "tts",
  "version": "${VERSION}",
  "executable": "${EXEC_REL_PATH}",
  "platform": "${PLATFORM_NAME}",
  "arch": "${ARCH_NAME}",
  "runtimeApiVersion": "2.0.0",
  "minimumDubbiOviVersion": "2.0.0",
  "packagedAt": "${PACKAGED_AT}",
  "files": ${FILES_JSON_ARRAY}
}
EOF

# -----------------------------------------------------------------------------
# Archive Package & Compute SHA-256 Hash
# -----------------------------------------------------------------------------
echo "--> Archiving package: ${ZIP_PATH}"
cd "${OUT_DIR}"
zip -q -r "$(basename "${ZIP_PATH}")" "$(basename "${STAGING_DIR}")"
cd - > /dev/null

SHA256_HASH=$(shasum -a 256 "${ZIP_PATH}" | awk '{print $1}')
echo "${SHA256_HASH}  $(basename "${ZIP_PATH}")" > "${ZIP_PATH}.sha256"

# Clean build temp directory
rm -rf "${BUILD_TMP}"

echo "================================================================="
echo " SUCCESS: Built ${PACKAGE_NAME}.zip"
echo " SHA-256 Hash: ${SHA256_HASH}"
echo "================================================================="
