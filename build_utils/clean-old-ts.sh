#!/usr/bin/env bash

#
# Run this *after* you've compiled a package to remove files
# that are no longer in the package (i.e, renames and deletes).
#

if [ "$(uname)" == "Darwin" ]; then
  XARGS_OPTS=
else
  XARGS_OPTS=-r
fi

diff --strip-trailing-cr <(
  find ${PWD}/dist -type f |
  sort
) <(
  yarn -s tsc -b --clean --dry |
  grep -e '^ ' |
  sed -e 's/^.*[*] //' |
  sort
) |
  grep -e '^< ' |
  sed -e 's/^< //' |
  xargs ${XARGS_OPTS} rm -v
