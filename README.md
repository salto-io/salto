# Salto OSS monorepo
[![Knuckles](bnw-face.png)](https://github.com/salto-io/salto/blob/main/docs/faq.md#why-did-we-choose-knuckles-as-our-mascot)
---

[![CircleCI](https://circleci.com/gh/salto-io/salto.svg?style=shield)](https://circleci.com/gh/salto-io/salto)
[![Coverage Status](https://coveralls.io/repos/github/salto-io/salto/badge.svg?branch=main)](https://coveralls.io/github/salto-io/salto?branch=main)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
---

Salto allows you to manage your business applications' configuration in code. By doing so, it enables modern devops style methodologies for development, testing and deployment for these business applications.

Salto consists of 3 main components:

1. The NaCl language — a declarative configuration language (follows the syntax of [hcl](https://github.com/hashicorp/hcl/tree/hcl2)), specifically designed to describe the configuration of modern business applications.
2. The Salto command line interface — a tool which uses NaCl files to manage the configuration of business applications, with operations such as `deploy` (to deploy configuration changes to a business application) and `fetch` (to fetch the latest state of a business application into NaCl files). This tool is composed of a core processing engine, and various adapters to interact with the different business applications.
3. The Salto vs-code extension — An extension to the popular vs-code IDE to easily interact with NaCl files.

For more information, see the [user guide](docs/user_guide.md) and the [FAQ](docs/faq.md).

To report issues or ask about using the Salto CLI - please join our public Slack channel [here](https://invite.playplay.io/invite?team_id=T011W61EVHD).

### Installing salto

#### CLI

Please head to our [releases](https://github.com/salto-io/salto/releases) page.
There you'll find prebuilt binaries for major OSes (MacOS, Linux, Windows).

#### VSCode extension

See [the vscode package documentation](packages/vscode/README.md#installation)

### Running using docker

```bash
docker build --tag salto-cli
docker run salto-cli
```

### Building from source

  1. Install Node.js 14 (for M1 Macs use 14.15). You can download it directly from [here](https://nodejs.org/en/download/releases/), or use [Node Version Manager (NVM)](https://github.com/nvm-sh/nvm) (simply run `nvm use`) to install it.
  2. Install [yarn 1](https://yarnpkg.com/en/docs/install).
  3. Fetch dependencies and build:

```bash
$ yarn
$ yarn build
```

### Running tests

```bash
$ yarn test
```

### E2E tests

By default, `yarn test` will run only unit tests - stored at the `tests` directory of each package.

E2E (end-to-end) tests are stored at the `e2e_tests` directories. To run them, define the `RUN_E2E_TESTS=1` environment variable:

```bash
RUN_E2E_TESTS=1 yarn test
```

E2E tests are run on CircleCI builds, and you should also run them locally before creating a PR.

**Important** E2E tests for the `cli` and `salesforce-adapter` need [valid SFDC credentials](packages/salesforce-adapter/README.md#E2E-tests) to run.

### Creating a release

_Salto_ is versioned using the [semantic versioning scheme](https://semver.org/). Therefore, when composing a new
release, we would:

  1. Bump the version in the packages' `package.json` files. For that, we're using `lerna`
  2. Tag the git repository with the new version
  3. Publish the packages in this repo to [npm](https://www.npmjs.com/org/salto-io)
  3. Build artifacts and attach them to a new [release in this repository](https://github.com/salto-io/salto/releases)

Here is how to do it:

#### TL;DR Quick method

Install [GitHub CLI](https://cli.github.com) and configure it (for example by running `gh pr status`).
Make sure you're on `main`, no local changes, CI status is passing, and run:

```bash
yarn lerna-version-pr [BUMP]
```

Where BUMP is a [lerna version](https://github.com/lerna/lerna/tree/main/commands/version#usage); default is  `patch`

This will create a [PR labeled `VERSION`](https://github.com/salto-io/salto/pulls?q=is%3Apr+label%3AVERSION). Once the PR is merged, the version will be published and a git tag will be created.

#### Create a PR manually

##### 1. Create a new version

```bash
yarn lerna-version [BUMP]
```

##### 2. Commit and push the version to git

Submit a PR and have it merged.

Once the PR is merged, the version will be published and a git tag will be created.

### Usage instructions

See READMEs of individual packages under the `packages` directory.

### License
[Apache License 2.0](LICENSE)
