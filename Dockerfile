FROM node:14.15.5-buster-slim
WORKDIR /app

RUN apt update && apt install -y openssl build-essential libgssapi-krb5-2 git ccache

COPY . .
RUN echo "Running yarn install" && yarn || yarn || yarn # run again if failing due to rimraf

RUN \
    echo "Running yarn build" && yarn pre-build && yarn build-ts

ENTRYPOINT ["/usr/bin/env", "node", "./packages/cli/bin/salto"]
