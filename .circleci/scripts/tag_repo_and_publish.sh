#!/usr/bin/env bash

set -eo pipefail

GITHUB_API_ENDPOINT=https://api.github.com
GITHUB_UPLOADS_ENDPOINT=https://uploads.github.com
REPO=salto-io/salto

if [ -z "$GITHUB_AUTH_TOKEN" ]; then
  echo >&2 "missing GITHUB_AUTH_TOKEN environment variable"
  exit 1
fi

if [ -z "$NPM_TOKEN" ]; then
  echo >&2 "missing NPM_TOKEN environment variable"
  exit 1
fi

if [ -z "$FILES_TO_UPLOAD" ]; then
  echo >&2 "missing FILES_TO_UPLOAD environment variable (filenames to upload to the Github release)"
  exit 1
fi

CURRENT_VERSION="$(jq -j .version lerna.json)"
VERSION_TAG="v${CURRENT_VERSION}"

push_new_git_tag() {
  echo "tagging and pushing new git tag: ${VERSION_TAG}"
  git tag $VERSION_TAG

  # prevent SSH fingerprint prompt on git push
  ssh -o StrictHostKeyChecking=no git@github.com || true
  git push origin $VERSION_TAG
}

publish_packages_to_npm() {
  echo "publishing to npm"
  # set token at npmrc - without making the git local copy dirty
  echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" >> .npmrc
  echo ".npmrc" >> .git/info/exclude
  git update-index --assume-unchanged .npmrc

  yarn lerna-publish -y --ignore-scripts
}

create_release_in_github() {
  echo "creating a github release"
  # https://developer.github.com/v3/repos/releases/#create-a-release
  new_release_json=$(echo -e "
  {
    \"tag_name\": \"${CIRCLE_TAG}\",
    \"prerelease\": false,
    \"draft\": false,
    \"name\": \"Salto ${CIRCLE_TAG}\"
  }" | jq -cM)

  release_result=$(curl -L -XPOST --fail \
    "${GITHUB_API_ENDPOINT}/repos/${REPO}/releases" \
    -d "$new_release_json" \
    -H "Authorization: token ${GITHUB_AUTH_TOKEN}" \
    -H "Content-Type: application/json")

  # attach assets to the release
  release_id=$(echo "$release_result" | jq .id -j)
  for f in $FILES_TO_UPLOAD; do
    curl "${GITHUB_UPLOADS_ENDPOINT}/repos/${REPO}/releases/${release_id}/assets?name=$(basename $f)" \
      -L -XPOST --fail \
      --data-binary @"$f" \
      -H "Authorization: token ${GITHUB_AUTH_TOKEN}" \
      -H "Content-Type: application/octet-stream" &
  done
  wait
}

push_new_git_tag
publish_packages_to_npm
create_release_in_github
