# Salto - CLI

This project is the command line interface for Salto.

### Download prebuilt executable binary releases

Salto is releasing a prebuilt executable binary of the CLI for all major operating systems [here](https://github.com/salto-io/salto/releases).

The prebuilt binaries are built using [`webpack`](https://github.com/webpack/webpack) and [`nexe`](https://github.com/nexe/nexe).

### Build instructions

```bash
yarn ; yarn build
```

### E2E tests

E2E tests need [valid SFDC credentials](../salesforce-adapter/README.md#E2E-tests) to run.

### Configuration

When running the first `salto init` command, a configuration file will be created in `$SALTO_HOME/.salto/salto.config/config.nacl`.
The file includes a unique installation ID (uuidv4) and telemetry settings, and it generally structured as follows:

```hcl
salto {
  installationID = "947270fd-bd63-4925-8e14-2e012ed6aa4b"
  telemetry = {
      enabled = true
  }
}
```

### Telemetry

Salto CLI collects and sends non personally identifiable usage data as part of its telemetry mechanism.
Please see [Telemetry](../../docs/telemetry.md) for more info.

Do note that **For dev builds**, i.e. builds that are not the prebuilt executables released by Salto, the telemetry will be **disabled**.
