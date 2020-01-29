#!/bin/sh

pushd $(dirname $0)/../packages/salesforce-adapter > /dev/null

yarn add --dev @pollyjs/adapter-node-http @pollyjs/core @pollyjs/persister-fs @types/pollyjs__adapter-node-http @types/pollyjs__core @types/pollyjs__persister-fs

popd
