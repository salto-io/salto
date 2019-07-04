#!/usr/bin/env bash

function abspath {
    [[ $1 = /* ]] && echo "$1" || echo "$PWD/${1#./}"
}

if [ $# -lt 1 ]
then
	echo "Usage build.sh <destination_dir>"
	exit 1
fi


dest=$(abspath $1)
js_dest=$dest/src/parser

pushd $(dirname $0) > /dev/null
echo -n 'Building go HCL plugin... '

# Build wasm
env GOOS=js GOARCH=wasm go build -o $dest/hcl.wasm

# Copy wasm to package root so that tests can run
cp $dest/hcl.wasm ../../..

# Copy wasm_exec.js to destination
mkdir -p $js_dest
cp ../wasm_exec.js $js_dest

echo 'Done'
popd > /dev/null

