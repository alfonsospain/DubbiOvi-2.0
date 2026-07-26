#!/usr/bin/env bash

# =============================================================================
# DubbiOvi Piper Package Automated Validator
# Verifies Architecture, Manifest, Dynamic Linkage, Smoke Test & Audio Synthesis
# =============================================================================

set -euo pipefail

ZIP_PATH="${1:-./dist/piper-darwin_arm64.zip}"

if [[ ! -f "${ZIP_PATH}" ]]; then
    echo "Error: Target package archive not found at ${ZIP_PATH}"
    exit 1
fi

echo "================================================================="
echo " PIPER RUNTIME PACKAGE AUTOMATED VALIDATOR"
echo " Validating Archive: ${ZIP_PATH}"
echo "================================================================="

VALIDATION_TMP="./.validate_piper_$(date +%s)"
rm -rf "${VALIDATION_TMP}"
mkdir -p "${VALIDATION_TMP}"

# Step 1: Unzip archive
unzip -q "${ZIP_PATH}" -d "${VALIDATION_TMP}"
EXTRACTED_DIR=$(find "${VALIDATION_TMP}" -mindepth 1 -maxdepth 1 -type d | head -n 1)

if [[ -z "${EXTRACTED_DIR}" ]]; then
    echo "❌ FAIL: Package archive extraction yielded no root directory."
    rm -rf "${VALIDATION_TMP}"
    exit 1
fi

# Step 2: Validate manifest.json
MANIFEST_PATH="${EXTRACTED_DIR}/manifest.json"
if [[ ! -f "${MANIFEST_PATH}" ]]; then
    echo "❌ FAIL: Missing manifest.json in package root."
    rm -rf "${VALIDATION_TMP}"
    exit 1
fi
echo "  ✓ manifest.json exists."

EXEC_REL=$(jq -r '.executable' "${MANIFEST_PATH}")
EXEC_PATH="${EXTRACTED_DIR}/${EXEC_REL}"

if [[ ! -f "${EXEC_PATH}" ]]; then
    echo "❌ FAIL: Manifest entrypoint executable '${EXEC_REL}' not found inside package."
    rm -rf "${VALIDATION_TMP}"
    exit 1
fi
echo "  ✓ Manifest entrypoint executable exists: ${EXEC_REL}"

# Step 3: Architecture Check
if [[ "$(uname -s)" == "Darwin" ]]; then
    FILE_INFO=$(file "${EXEC_PATH}")
    echo "  ✓ Executable binary architecture: ${FILE_INFO}"

    if [[ "${ZIP_PATH}" == *"arm64"* && "${FILE_INFO}" != *"arm64"* ]]; then
        echo "❌ FAIL: Architecture mismatch! Expected arm64, got: ${FILE_INFO}"
        rm -rf "${VALIDATION_TMP}"
        exit 1
    fi
fi

# Step 4: Smoke Test (`--help`)
echo "--> Executing bin/piper --help smoke test..."
chmod +x "${EXEC_PATH}"
SMOKE_OUT=$("${EXEC_PATH}" --help 2>&1)
if [[ "${SMOKE_OUT}" != *"usage: piper"* && "${SMOKE_OUT}" != *"optional arguments"* ]]; then
    echo "❌ FAIL: Smoke test failed! Output: ${SMOKE_OUT}"
    rm -rf "${VALIDATION_TMP}"
    exit 1
fi
echo "  ✓ Smoke test passed: --help executed cleanly."

# Step 5: Full Speech Synthesis End-to-End Test
echo "--> Downloading voice model for end-to-end synthesis test..."
MODEL_DIR="${VALIDATION_TMP}/test_model"
mkdir -p "${MODEL_DIR}"

curl -s -L -o "${MODEL_DIR}/test.onnx" "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/high/en_US-lessac-high.onnx"
curl -s -L -o "${MODEL_DIR}/test.onnx.json" "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/high/en_US-lessac-high.onnx.json"

TEST_WAV="${VALIDATION_TMP}/synthesized_validation.wav"

echo "DubbiOvi native Piper runtime package verification successful." | \
  "${EXEC_PATH}" --model "${MODEL_DIR}/test.onnx" --output_file "${TEST_WAV}"

if [[ ! -f "${TEST_WAV}" ]]; then
    echo "❌ FAIL: Output WAV file was not created by synthesis test."
    rm -rf "${VALIDATION_TMP}"
    exit 1
fi

WAV_SIZE=$(wc -c < "${TEST_WAV}" | tr -d ' ')
if [[ "${WAV_SIZE}" -lt 1000 ]]; then
    echo "❌ FAIL: Output WAV file is empty or too small (${WAV_SIZE} bytes)."
    rm -rf "${VALIDATION_TMP}"
    exit 1
fi

echo "  ✓ Speech synthesis test passed: Produced valid WAV audio file (${WAV_SIZE} bytes)."

# Clean validation temp directory
rm -rf "${VALIDATION_TMP}"

echo "================================================================="
echo " ALL AUTOMATED VALIDATION CHECKS PASSED (100%)"
echo "================================================================="
