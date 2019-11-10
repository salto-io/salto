FROM circleci/node:12.12

RUN sudo npm i --global yarn@1.19.1

# Install go (needed for HCL parser WebAssembly build)
RUN wget -q https://dl.google.com/go/go1.13.linux-amd64.tar.gz -O - | sudo tar -C /usr/local -xz
ENV PATH $PATH:/usr/local/go/bin

# Download HCL parser dependecies to speed up test builds
ENV GO111MODULE=on
RUN go get -v \
  github.com/hashicorp/hcl2@v0.0.0-20190607155442-318e80eefe28 \
  github.com/zclconf/go-cty@v1.0.0 \
  github.com/mitchellh/go-wordwrap@v0.0.0-20150314170334-ad45545899c7 \
  github.com/apparentlymart/go-textseg@v1.0.0 \
  github.com/agext/levenshtein@v1.2.1 \
  github.com/google/go-cmp@v0.2.0 \
  golang.org/x/text@v0.3.2

