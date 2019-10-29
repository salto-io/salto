GENERATED_DIR=./src/generated

rm -rf ${GENERATED_DIR}
mkdir -p ${GENERATED_DIR}
. ./version_json.sh > ./src/generated/version.json
