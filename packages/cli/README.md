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

### Telemetry

Salto CLI collects telemetry data. The data is being used by Salto to improve performance of the
product as well as detect bugs and issues.
Some of the things that telemetry helps us analyze are:

  * Slow `fetch` and `deploy`
  * Issues with exporting/importing/deleting from/to CSV files
  * Number of changes on `fetch` and `deploy` in correlation to failures

#### Which data is being sent?

The data that's being sent is strictly usage data along with metadata.
No personal data being collected.

There are two main types of such data:

  1. Counters, for example:
    * Number of changes upon `fetch`
    * Failed running some command (counting number of failures)
    * Started running some command
  2. Stacktrace - Salto's binaries are being built with `webpack` and `next` - paths are always relative to the binary and not the user's paths

In addition to the usage data, the following metadata is being sent;

  * Operating system (platform, arch and release version)
  * Workspace ID: the ID of the specific workspace (uuidv4)
  * Installation ID: an ID that is being generated in the first ever `salto init`. It's common to all of the workspaces
  * App (CLI) version

#### Disable telemetry

Any user can opt-out from sending usage data.
There are generally two ways of doing so:

  1. Setup the `SALTO_TELEMETRY_DISABLE` environment variables value to be `1`
  2. In the CLI configuration file (`$SALTO_HOME/salto.config/config.bp` by default), setup the value of `telemetry` to be `false`.

By default, binary releases are generating the configuration file to be populated
with telemetry enabled, however the environment variable `SALTO_TELEMETRY_DISABLE=1` will always
have precedence over the config file.

**For dev builds**, i.e. builds that are not binary builds released by Salto, the telemetry will be
**disabled**, unless explicitly configured to send telemetry.
If you want to enable telemetry for dev builds, please setup the following environment variables:

  * `SALTO_TELEMETRY_URL` - the URL to which the usage data will be sent
  * `SALTO_TELEMETRY_TOKEN` - the authorization token for the telemetry service

Some events
