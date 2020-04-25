#!/usr/bin/env bash

set -eo pipefail

GIT_BASE_REVISION=${1-}
if [ -z "$GIT_BASE_REVISION" ]; then
  echo >&2 "usage: $0 git_base_revision"
  exit 1
fi

CURRENT_VERSION="$(jq -j .version lerna.json)"
PREV_VERSION="$(git show ${GIT_BASE_REVISION}:lerna.json | jq -j .version)"

if [ "$CURRENT_VERSION" == "$PREV_VERSION" ]; then
  echo "version was not changed, halting job"
  circleci-agent step halt
fi
