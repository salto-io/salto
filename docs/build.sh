#!/usr/bin/env bash

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
OUTPUT_DIR=${OUTPUT_DIR:-output}

function usage () {
  echo "Build and sync Salto documentation
    -h       Display this message

    The script generates an html file, uploading it to S3 and
    invalidating cloudfront cache.
    Available environment variables:
    DOCS_S3_BUCKETS:          A comma separated string of  bucket names
                              you want to upload the generated file to.
    DOCS_CLOUDFRONT_DIST_IDS: A comma separated string of Cloudfront distribution IDs you want to create
                              distribution IDs you want to create cache invalidations in.
    "
    exit 0
}

while getopts ":h" opt
do
  case $opt in

  h)  usage
      exit 0
      ;;
  esac
done
shift $(($OPTIND-1))

mkdir -p "$OUTPUT_DIR"
cp "$SCRIPT_DIR"/*.png "$OUTPUT_DIR"

npm i -g showdown

for md_file in $(find "$SCRIPT_DIR" -type f -name '*.md'); do
  echo "generating ${md_file} html"
  filename_without_extension=$(basename "$md_file" '.md')
  node showdown_wrapper.js "$md_file" > "${OUTPUT_DIR}/${filename_without_extension}.html"
done

# Upload newly generated file to S3 buckets

if [ -z "$DOCS_S3_BUCKETS" ]; then
  echo "DOCS_S3_BUCKETS was not specified - not uploading generated files"
  exit 0
fi

echo "uploading ${OUTPUT} to S3 buckets"
IFS=","
for bucket in $DOCS_S3_BUCKETS; do
  find "$OUTPUT_DIR" -type f \
    -exec aws s3 cp {} "s3://${bucket}" \;
done

# Invalidate cloudfront caches

if [ -z "$DOCS_CLOUDFRONT_DIST_IDS" ]; then
  echo "$DOCS_CLOUDFRONT_DIST_IDS (distribution ids) were not specified, not creating invalidations"
  exit 0
fi

echo "invalidating cloudfront distributions"
IFS=","
for dist_id in $DOCS_CLOUDFRONT_DIST_IDS; do
  aws cloudfront create-invalidation --distribution-id "$dist_id" --paths '/*'
done
