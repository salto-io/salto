# Salto configuration

# Configuration files

This document details some of the various ways to configure the salto tool itself.

## Workspace configuration

### Shared configuration

Located inside the workspace directory in `salto.config/workspace.nacl`

This holds information that defines the workspace itself and should be the same regardless of where the workspace is currently viewed from
```hcl
uid: string
baseDir: string
name: string
envs: Record<string, {baseDir: string; config: EnvConfig}>
localStorage: string
staleStateThresholdMinutes: number
```

### Local configuration

Located in the workspace's "localStorage" (by default this is `~/.salto/<workspace_name>-<workspace-uid>`) under `<localStorage>/workspaceUser.nacl`

This holds information that relates to the workspace but is "local" to the current user
```hcl
currentEnv: string
```

### Adapter configuration

Every adapter that is used in a workspace can have its own custom configuration.

Located inside the workspace directory in `salto.config/adapters/<adapter_name>.nacl`

Each configuration file holds information that is relevant to the specific adapter

## Global Salto configuration

Located in `~/.salto/salto.config/config.nacl`

This configuration holds information that is used to configure the behavior of the Salto CLI
```hcl
AppConfig:
      installationID: string
      telemetry: TelemetryConfig

TelemetryConfig:
      url: string
      enabled: boolean
      token: string
      flushInterval?: number
```

This configuration file is being generated on the first time the user
is running the `init` command.

# Environment variables

| Name                   | Default when undefined      | Description
| -----------------------| ----------------------------| -----------
| SALTO_HOME             | ~/.salto                    | determines default the location of workspace local configs, credentials and cache
| SALTO_LOG_FILE         | null (write to stdout)      | Path of the file to write log messages to
| SALTO_LOG_LEVEL        | none                        | Log level (possible values: info, debug, warn, error, none)
| SALTO_LOG_FORMAT       | text                        | Control the log format (possible values: text, json)
| SALTO_LOG_NS           | undefined (no filtering)    | If a string is specified, it is parsed as a glob - only logs having matching namespaces will be written
| SALTO_LOG_COLOR        | null (colorize if writing to stdout and the stream supports color) | Override colorization in output
| SALTO_TELEMETRY_DISABLE| defaults to the value from the global Salto configuration | Overrides the values from the global Salto configuration. Disables telemetry sending when the value is 1. TODO See HERE for information on Salto telemetry
| SALTO_TELEMETRY_URL    | defaults to the value from the global Salto configuration. | Overrides the values from the global Salto configuration. URL to send telemetry information to. TODO See HERE for information on Salto telemetry
| SALTO_TELEMETRY_TOKEN  | defaults to the value from the global Salto configuration. |Overrides the values from the global Salto configuration. The authentication token to use when sending telemetry information
