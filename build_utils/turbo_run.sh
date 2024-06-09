#!/usr/bin/env bash

if [ -z "$TURBO_TOKEN" ]; then
  yarn run "$@"
else
  yarn turbo run "$@" \
--token="${TURBO_TOKEN:-NOPE}" \
--team="${TURBO_TEAM:-SaltoDev}" \
--concurrency="${TURBO_CONCURRENCY:-4}"
fi

