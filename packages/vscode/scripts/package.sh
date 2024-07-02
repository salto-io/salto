#!/bin/bash

if ! command -v rsync &> /dev/null
then
    if [[ "$CI" == "1" ]]
    then
        sudo apt update && sudo apt install -y rsync
    else
        echo "Error: rsync is not installed."
        exit 1
    fi
fi

set -xeuo pipefail
shopt -s extglob

yarn workspaces focus salto-vscode


rm -rf ./tmp_pkg
mkdir -p ./tmp_pkg && cp ../../LICENSE . && vsce package --yarn -o ./tmp_pkg/salto.vsix && rm -f LICENSE

pushd ./tmp_pkg 
unzip salto.vsix
mkdir -p extension/node_modules/
rsync -a --exclude '@salto-io' ../../../node_modules extension/node_modules/
zip -ur salto.vsix extension
popd

mkdir -p ./pkg
mv ./tmp_pkg/salto.vsix ./pkg/salto.vsix

rm -rf ./tmp_pkg
