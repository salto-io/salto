# Salto - Adapter api test utilities

---

This package contains utilities for working with the [jest framework](https://jestjs.io/) and salto elements.

## Usage

The standard way to use the jest extensions in this package is to install them all by adding

```
setupFilesAfterEnv: ['@salto-io/adapter-api-test-utils/all'],
```

to the jest config file.
This will automatically install all custom matchers and equality testers to all test files in the project

## Contribute

See documentation about [Equality Testers](https://jestjs.io/docs/expect#expectaddequalitytesterstesters) and [Custom matchers](https://jestjs.io/docs/expect#expectextendmatchers)

Make sure to add any new tester or matcher to the `all.ts` file so they will be registered.
