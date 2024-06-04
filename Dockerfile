FROM node:18.9.0-buster-slim
WORKDIR /app

RUN apt update && apt install -y openssl build-essential libgssapi-krb5-2 git ccache

COPY . .
RUN echo "Updating yarn" && YARN_IGNORE_NODE=1 yarn set version 3.1.0
RUN echo "Running yarn install" && yarn 

RUN \
    echo "Running yarn build" && yarn pre-build && yarn build-ts

ENTRYPOINT ["/usr/bin/env", "node", "./packages/cli/bin/salto"]
