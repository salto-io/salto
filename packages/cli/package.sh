#!/bin/bash

set -euo pipefail

function de_hoist_package() {
    cp -R "../../node_modules/$1" ../../node_modules/@salto-io/rocksdb/node_modules/
}

echo "workaround for yarn berry hoisting @salto-io/rocksdb dependencies"
missing_dependencies='["is-buffer","catering","queue-tick","node-gyp-build"]'
for dep in $(echo "$missing_dependencies" | jq -r '.[]'); do
    de_hoist_package "$dep"
done

node ./package_native.js