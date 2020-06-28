#!/usr/bin/env bash

set -euo pipefail

# get branch name, remove weird characters, e.g, pull/1150 -> pull-1150
# this will be the NPM dist-tag
GIT_ID=$(git rev-parse --abbrev-ref HEAD | sed -E "s/[^a-zA-Z0-9_-]/-/g")

# run 'lerna version' to get get next prerelease
yarn lerna version prerelease --no-git-tag-version --preid $GIT_ID --ignore-scripts --exact --yes

# modify the prerelease to include the git commit hash
VERSION=$(jq -r .version lerna.json | sed -E "s/[^.]+$/$(git rev-parse --short HEAD)/")

# run 'lerna version' again to actually set the version with the commit hash
yarn lerna version $VERSION --no-git-tag-version --preid $GIT_ID --ignore-scripts --exact --yes

# commit that goes nowhere
git commit -m "canary version $VERSION" lerna.json packages/*/package.json

# publish
yarn lerna publish from-package --pre-dist-tag $GIT_ID --yes

# undo the commit
git reset --hard HEAD^1
