FROM node:18.9.0-buster-slim
WORKDIR /app

RUN \
    apt update && \
    apt install -y openssl build-essential libgssapi-krb5-2 git ccache python3

COPY . .

RUN echo "Updating yarn" && \
    corepack enable

RUN echo "Running yarn install" && \
    yarn --immutable

RUN \
    echo "Running yarn build" && \
    yarn pre-build && \
    yarn build-ts

ENTRYPOINT ["/usr/bin/env", "node", "./packages/cli/bin/salto"]
