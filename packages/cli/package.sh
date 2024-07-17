#!/bin/bash

set -euo pipefail

function de_hoist_package() {
    cp -R "../../node_modules/$1" ../../node_modules/@salto-io/rocksdb/node_modules/
}

echo "workaround for yarn berry hoisting @salto-io/rocksdb dependencies"
missing_dependencies=("is-buffer" "catering" "queue-tick" "node-gyp-build")
for package in "${missing_dependencies[@]}"; do
  de_hoist_package "${package}"
done

node ./package_native.js
