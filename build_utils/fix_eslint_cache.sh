#!/usr/bin/env bash

# eslint cache is based on file mtime, which breaks in CI because it changes every time we clone
# the repo. This script sets the mtime of source files (.ts, .js, .tsx, .jsx) according to their
# MD5 checksum.
#
# Inspired by: https://github.com/DestinyItemManager/DIM/issues/3651#issuecomment-474642301

function set_mtime_to_md5 {
  FILE=$1
  MD5=$(date -d \@$((0x$(md5sum $FILE | cut -b 1-7))))
  touch $FILE -d $MD5 -c
}

jq -r '.[0] | keys | .[]' .eslintcache | while read FILE; do
  set_mtime_to_md5 $FILE;
done