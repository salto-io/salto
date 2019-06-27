#!/usr/bin/env bash

function abspath {
    [[ $1 = /* ]] && echo "$1" || echo "$PWD/${1#./}"
}

if [ $# -lt 1 ]
then
	echo "Usage build.sh <destination> [other destination]"
	exit 1
fi

dest=$(abspath $1)

pushd $(dirname $0) > /dev/null
echo -n 'Building go HCL plugin... '
env GOOS=js GOARCH=wasm go build -o $dest
echo 'Done'
popd > /dev/null

if [ $# -eq 2 ]
then
	cp $dest $2
fi
