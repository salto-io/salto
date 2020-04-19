# Salto - CLI

This project is the command line interface for Salto.

### Download prebuilt executable binary releases

Salto is releasing a prebuilt executable binary of the CLI for all major operating systems.
The prebuilt binaries are built using [`webpack`](https://github.com/webpack/webpack) and [`nexe`](https://github.com/nexe/nexe).

> TODO specific instructions on how to download

### Build instructions

```bash
yarn
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

The data is being used to improve the product's performance, as well as detect bugs and issues.

Some of the things that telemetry helps us analyze are:

  * Slow `fetch` and `deploy`
  * Number of changes on `fetch` and `deploy` in correlation to failures

#### Which data is being sent?

The data that's being sent is strictly usage data along with metadata.
No personal data is being collected.

There are two main types of such data:

  1. Counters, for example:
    * Number of changes upon `fetch`
    * Failed running some command (counting number of failures)
    * Started running some command
  2. Stacktrace - the prebuilt binaries are being packaged with `webpack` ([see the prebuilt binary releases section](#download-prebuilt-executable-binary-releases)) so the file paths will be in the [custom webpack sourcemap protocol](https://webpack.js.org/configuration/output/#output-devtoolmodulefilenametemplate), thus no personal data will be sent.

In addition to the usage data, the following metadata is being sent;

  * Operating system (platform, arch and release version)
  * Workspace ID: the ID of the specific workspace (uuidv4)
  * Installation ID: an ID that is being generated in the first ever `salto init`. It's common to all of the workspaces on the same installation / computer
  * App (CLI) version

#### Disable telemetry

Any user can opt-out of sending usage data.
There are generally two ways of doing so:

  1. Setup the `SALTO_TELEMETRY_DISABLE` environment variables value to be `1`
  2. In the CLI configuration file (`$SALTO_HOME/salto.config/config.nacl` by default), set the value of `telemetry` to be `false`.

By default, binary releases are generating the configuration file to be populated
with telemetry enabled, however the environment variable `SALTO_TELEMETRY_DISABLE=1` will always
have precedence over the config file.

**For dev builds**, i.e. builds that are not the prebuilt executables released by Salto, the telemetry will be
**disabled**.
