#!/usr/bin/env bash
TURBO_CONCURRENCY="${TURBO_CONCURRENCY:-"100%"}"
ARGS=("$@")

if [ -n "$CI" ]; then

  # new TURBO UI crashes when running in CI context
  export TURBO_UI=false

  # running in CI with 100% CPU will OOM
  TURBO_CONCURRENCY="50%"

  container_cpu_quota="/sys/fs/cgroup/cpu/cpu.cfs_quota_us"
  container_cpu_scale="/sys/fs/cgroup/cpu/cpu.cfs_period_us"

  if [ -f "$container_cpu_quota" ] && [ -f "$container_cpu_scale" ]; then

    # when CI runs in containers, finding the total allotted CPU is trickier
    TURBO_CONCURRENCY="$(awk -v quota="$(cat /sys/fs/cgroup/cpu/cpu.cfs_quota_us)" -v period="$(cat /sys/fs/cgroup/cpu/cpu.cfs_period_us)" 'BEGIN { printf "%.0f\n", (quota / period) * 0.5 }')"

  fi
else

  #
  # when running locally, we want to avoid turbocache missing updates in other packages
  # and doing less work.
  # we achieve this by setting the SALTO_DEPENDENCIES_HASH env var, which turbo.json uses in 
  # relevant steps (e.g. test) as a hint to identify when cache invalidation is in order
  #
  # we piggy-back off the --filter arg, to generate the relevant hashing for the package
  # that the user wants to run (or all of them, if we can't find it)
  #

  ARGS_filter=("$@")

  filter=""
  for arg in "${ARGS_filter[@]}"; do
    if [[ $arg == --filter=* ]]; then
      filter="${arg#--filter=}"
      break
    elif [[ $arg == --filter ]]; then
      shift
      filter="$1"
      break
    else
      shift
    fi
  done

  __CMD_HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  _dependency_hash=""

  pushd "$__CMD_HERE/.."

  if [ -n "$filter" ]; then
    echo "node ./build_utils/hash_dependencies.js -p $filter"
    _dependency_hash="$(node ./build_utils/hash_dependencies.js -p "$filter")"
  else
    echo "node $__CMD_HERE/hash_dependencies.js"
    _dependency_hash="$(node "$__CMD_HERE"/hash_dependencies.js)"
  fi

  popd

  export SALTO_DEPENDENCIES_HASH="$_dependency_hash"
fi

yarn turbo run  \
  --no-update-notifier --concurrency="$TURBO_CONCURRENCY" \
  "${ARGS[@]}"
