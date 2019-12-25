# Salto OSS monorepo

[![CircleCI](https://circleci.com/gh/salto-io/salto.svg?style=shield&circle-token=e64029d1886e2965a8d51b09597054b5a1e84733)](https://circleci.com/gh/salto-io/salto) &nbsp; &nbsp; [![codecov](https://codecov.io/gh/salto-io/salto/branch/master/graph/badge.svg?token=iZeoxV5WBR)](https://codecov.io/gh/salto-io/salto)

---

### Building

Install [yarn](https://yarnpkg.com/en/docs/install).

```bash
brew install yarn
```

Install and build:

```bash
yarn
yarn build
```

### Running tests

```bash
yarn test
```

### E2E tests

By default, `yarn test` will run only unit tests - stored at the `tests` directory of each package.

E2E (end-to-end) tests are stored at the `e2e_tests` directories. To run them, define the `RUN_E2E_TESTS=1` environment variable:

```bash
RUN_E2E_TESTS=1 yarn test
```

E2E tests are run on CircleCI builds, and you should also run them locally before creating a PR.

**Important** E2E tests for the `cli` and `salesforce-adapter` need [valid SFDC credentials](packages/salesforce-adapter/README.md#E2E-tests) to run.

### Usage instructions

See READMEs of individual packages under the `packages` directory.
