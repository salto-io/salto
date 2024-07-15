#!/bin/bash

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "$0 package_name version search_path"
    echo "example:"
    echo "$0 @typescript-eslint/eslint-plugin 6.7.3 packages"
    exit 1
fi

# Define the path to start searching from; . means the current directory
if [[ -z "$3" ]]; then
    SEARCH_PATH="."
else
    SEARCH_PATH="$3"
fi

# Use the find command to get all package.json files from the SEARCH_PATH
find "$SEARCH_PATH" -name "package.json" | while read -r file; do
    echo "Updating $file..."

    # Use jq to update the package.json devDependencies and save the modified file in-place
    jq \
    'if .dependencies["'"$1"'"]? then .dependencies["'"$1"'"] = "'"$2"'" else . end |
    if .devDependencies["'"$1"'"]? then .devDependencies["'"$1"'"] = "'"$2"'" else . end' \
    "$file" > tmp.$$.json && mv tmp.$$.json "$file"
done

echo "Update complete."
