#!/bin/bash
SCRIPT_BASE="$( cd -P "$( dirname "$0" )" && pwd )"
PACKAGE_ROOT="${SCRIPT_BASE}/.."
TMP_PACKAGE_ROOT="${PACKAGE_ROOT}/tmp_pkg"
mkdir -p ${TMP_PACKAGE_ROOT} && ${PACKAGE_ROOT}/node_modules/.bin/vsce package --yarn -o ${TMP_PACKAGE_ROOT}/salto.vsix
cd ${TMP_PACKAGE_ROOT} && unzip salto.vsix
cp -r ${PACKAGE_ROOT}/node_modules/* ${TMP_PACKAGE_ROOT}/extension/node_modules/
zip -ur ${TMP_PACKAGE_ROOT}/salto.vsix ./extension
cd ${PACKAGE_ROOT}
mkdir -p ${PACKAGE_ROOT}/pkg
cp ${TMP_PACKAGE_ROOT}/salto.vsix ${PACKAGE_ROOT}/pkg/salto.vsix
rm -rf ${TMP_PACKAGE_ROOT}
