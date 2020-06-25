#!/usr/bin/env bash

# eslint will verify that the license header exists on the linted source files, this script is
# to verify that other non-linted files also contains the license header

# get the license header from the eslintrc configuration
set -euo pipefail
if [ ! -f 'eslintrc.js' ]; then
  echo 'cannot find eslintrc.js file'
  exit 1
fi
license_header=$(node -e "var license_head = require('./eslintrc.js'); console.log(\`/*\${license_head.rules['header/header'][2].join('\n')}*/\`)")
src_files_without_license_header=""
for f in $(find . -type f -name '*.js' -not -path '*node_modules*' -not -path '*dist\/*' -not -path '*coverage\/*'); do
  if ! grep -qFx "$license_header" "$f"; then
    src_files_without_license_header+="$f\n"
  fi
done

if [ ! -z "$src_files_without_license_header" ]; then
  echo -e "the following source files do not contain license header:\n${src_files_without_license_header}"
  exit 1
fi
