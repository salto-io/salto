#!/usr/bin/env bash
SCRIPT_DIR=$(dirname "$(realpath "$0")")
GENERATED_DIR="${SCRIPT_DIR}/src/generated"

rm -rf "${GENERATED_DIR}"
mkdir -p "${GENERATED_DIR}"
. "${SCRIPT_DIR}/version_json.sh" > "${GENERATED_DIR}/version.json"
