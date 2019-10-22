#!/bin/bash
mkdir -p ./tmp_pkg && vsce package --yarn -o ./tmp_pkg/salto.vsix
cd ./tmp_pkg && unzip salto.vsix 
cp -r ../node_modules/ extension/node_modules/ 
zip -ur salto.vsix extension 
cd ..
mkdir -p ./pkg 
cp ./tmp_pkg/salto.vsix ./pkg/salto.vsix 
rm -rf ./tmp_pkg