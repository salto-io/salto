#!/usr/bin/env bash

set -euo pipefail

docker build -t saltolabs/salto-e2e .

docker push saltolabs/salto-e2e