#!/usr/bin/env bash

set -euo pipefail

if ! git diff-index --quiet --no-ext-diff HEAD --; then
  echo >&2 "Git working copy is dirty, aborting"
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"

if [ "$CURRENT_BRANCH" != "master" ]; then
  echo >&2 "Must be on branch master (current branch: $CURRENT_BRANCH), aborting"
  exit 1
fi

GIT_REMOTE=origin

if [ -z "$(git remote get-url $GIT_REMOTE)" ]; then
  echo >&2 "Could not find remote $GIT_REMOTE, aborting"
  exit 1
fi

command -v hub >/dev/null 2>&1 || {
  echo >&2 "hub command is not installed, aborting."
  echo >&2 "See https://github.com/github/hub#installation"
  exit 1
}

#SUCCESS_STATUS=success
SUCCESS_STATUS="no status"
if [ "$(hub ci-status)" != "$SUCCESS_STATUS" ]; then
  echo >&2 "Could not verify ci status for current branch, aborting"
  echo >&2 "Make sure 'hub' is correctly configured to access GitHub and CI status is 'success'"
  exit 1
fi

BUMP=${1:-patch}

lerna version $BUMP -y --no-git-tag-version --ignore-scripts --exact --no-commit-hooks

DIRTY_FILES=$(git diff-index --name-only HEAD)

VERSION=$(node -p "require('./lerna.json').version")

git checkout -b v${VERSION}

git commit -m "Bump to version ${VERSION}" $DIRTY_FILES

git push ${GIT_REMOTE} HEAD

hub pull-request --no-edit -l VERSION
