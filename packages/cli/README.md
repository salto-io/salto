# salto - CLI

### TODO high-level description of the project's goal

### Build instructions

```bash
yarn
```

### E2E tests

E2E tests need [valid SFDC credentials](../salesforce-adapter/README.md#E2E-tests) to run.

### Configuration

When running the first `salto init` command, a configuration file will be created in `$SALTO_HOME/.salto/salto.config/config.bp`.
The file includes a unique installation ID (uuidv4) and telemetry settings, and it generally structured as follows:

```
salto {
  installationID = "947270fd-bd63-4925-8e14-2e012ed6aa4b"
  telemetry = {
      enabled = true
  }
}
```

#### Telemetry

There are defaults defined in the webpack configuration file, so production releases are built with defaulting
to `enalbed = true`.
Local builds will be configured with `enabled = false`, unless the `SALTO_TELEMETRY_URL` has been configured.

Enabling or disabling telemetry events can be also controlled by using the environment variables `SALTO_TELEMETRY_DISABLE`.
`SALTO_TELEMETRY_DISABLE` will always override the `config.bp` definition, thus `enabled` can be set to `true` but
one can turn off telemetry stats sending for a specific run of some salto command.

Set `SALTO_TELEMETRY_DISABLE=1` to disable telemetry.
