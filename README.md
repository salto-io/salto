# Salto OSS monorepo

[![CircleCI](https://circleci.com/gh/salto-io/salto.svg?style=shield&circle-token=e64029d1886e2965a8d51b09597054b5a1e84733)](https://circleci.com/gh/salto-io/salto) &nbsp; &nbsp; [![codecov](https://codecov.io/gh/salto-io/salto/branch/master/graph/badge.svg?token=iZeoxV5WBR)](https://codecov.io/gh/salto-io/salto)

---
Salto allows you to manage your business applications' configuration in code. By doing so, it enables modern devops style methodologies for development, testing and deployment for these business applications.

Salto consists of 3 main components:

1. The NaCl language — a declarative configuration language (follows the syntax of [hcl](https://github.com/hashicorp/hcl/tree/hcl2)), specifically designed to describe the configuration of modern business applications.
2. The Salto command line interface — a tool which uses NaCl files to manage the configuration of business applications, with operations such as `deploy` (to deploy configuration changes to a business application) and `fetch` (to fetch the latest state of a business application into NaCl files). This tool is composed of a core processing engine, and various adapters to interact with the different business applications.
3. The Salto vs-code extension — An extension to the popular vs-code IDE to easily interact with NaCl files.

For more information, see the [user guide](docs/user_guide.md) and the [FAQ](docs/faq.md).

### Building

  1. Install [yarn](https://yarnpkg.com/en/docs/install).
  2. Fetch dependencies and build:

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

### Publishing to NPM

#### TL;DR Quick method

Install [hub](https://github.com/github/hub) and configure it (for example by running `hub ci-status`).
Make sure you're on `master`, no local changes, CI status is passing, and run:

```bash
yarn lerna-version-pr [BUMP]
```

Where BUMP is a [lerna version](https://github.com/lerna/lerna/tree/master/commands/version#usage); default is  `patch`

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
