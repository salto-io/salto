cat <<EOF
{
  "version": "${npm_package_version}",
  "branch": "$(git rev-parse --abbrev-ref HEAD)",
  "hash": "$(git rev-parse --short HEAD)"
}
EOF