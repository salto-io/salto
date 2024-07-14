#!/usr/bin/env bash
TURBO_CONCURRENCY="${TURBO_CONCURRENCY:-"100%"}"
ORG_ARG=( "$@" )

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

fi

yarn turbo run "${ORG_ARG[@]}" \
  --concurrency="$TURBO_CONCURRENCY"
