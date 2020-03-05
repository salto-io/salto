#!/usr/bin/env bash

set -euo pipefail

GIT_BASE_REVISION=${1-}
if [ -z "$GIT_BASE_REVISION" ]; then
  echo >&2 "usage: $0 git_base_revision"
  exit 1
fi

CURRENT_VERSION="$(jq -j .version lerna.json)"
PREV_VERSION="$(git show ${GIT_BASE_REVISION}:lerna.json | jq -j .version)"
if [ "$CURRENT_VERSION" != "$PREV_VERSION" ]; then
  echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc
  yarn lerna-publish -y --ignore-scripts
  VERSION_TAG="v${CURRENT_VERSION}"
  git tag $VERSION_TAG
  git push origin $VERSION_TAG
fi
