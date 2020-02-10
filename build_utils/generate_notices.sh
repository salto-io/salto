#!/usr/bin/env bash

# Since Mac (BSD) `sed` does NOT support case insensitive matcher (/gI) we need to pipe the output twice, once to match
# the uppercase + spaces form of notice and one to match the lowercase + dashes form.
yarn --silent licenses generate-disclaimer \
  | sed 's/WORKSPACE AGGREGATOR [0-9A-F]\{8\} [0-9A-F]\{4\} 4[0-9A-F]\{3\} [89AB][0-9A-F]\{3\} [0-9A-F]\{12\}/SALTO/g' \
  | sed 's/workspace-aggregator-[0-9a-f]\{8\}-[0-9a-f]\{4\}-4[0-9a-f]\{3\}-[89ab][0-9a-f]\{3\}-[0-9a-f]\{12\}/salto/g' \
  > NOTICES
