# salto - CLI

### TODO high-level description of the project's goal

### Build instructions

```bash
yarn
```

### E2E tests

E2E tests need [valid SFDC credentials](../salesforce-adapter/README.md#E2E-tests) to run.

### Telemetry

There are defaults defined in the webpack configuration file, so production releases are built with defaulting
to `enalbed = true` and `url = telemetry.salto.io`.
Local builds will be configured with `enabled = false`
