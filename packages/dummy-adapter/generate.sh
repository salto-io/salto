#!/usr/bin/env bash
mkdir -p dist/src/data/
cp src/data/strings.dat dist/src/data/strings.dat
rm -rf dist/src/data/fixtures
cp -R src/data/fixtures/ dist/src/data/fixtures/