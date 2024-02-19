# Okta adapter configuration

## Configuration example

```hcl
okta {
  client = {
    retry = {
      maxAttempts = 5
      retryDelay = 5000
    }
    rateLimit = {
      total = -1
      get = 20
    }
  }
  fetch = {
    include = [
      {
        type = ".*"
      },
    ]
    exclude = [
      {
        type = "Group"
        criteria = {
          name = "name.*"
        }
      }
    ]
  }
}
```

## Configuration options

| Name                                    | Default when undefined | Description                                                               |
| --------------------------------------- | ---------------------- | ------------------------------------------------------------------------- |
| [client](#client-configuration-options) | `{}` (no overrides)    | Configuration relating to the client used to interact with Okta           |
| [fetch](#fetch-configuration-options)   | `{}` (no overrides)    | Configuration relating to the endpoints that will be queried during fetch |

### Client configuration options

| Name                                             | Default when undefined | Description                                                         |
| ------------------------------------------------ | ---------------------- | ------------------------------------------------------------------- |
| [retry](#retry-configuration-options)            | `{}` (no overrides)    | Configuration for retrying on errors                                |
| [rateLimit](#rate-limit-configuration-options)   | `{}` (no overrides)    | Limits on the number of concurrent requests of different types      |
| [maxRequestsPerMinute]                           | 700                    | Limits on the number of requests per minute                         |
| usePrivateAPI                                    | true                   | Whether to use Okta Private API when fetching and deploying changes |
| [timeout](#client-timeout-configuration-options) | `{}` (no overrides)    | Configuration for setting request timeouts                          |

#### Client timeout configuration options

| Name                 | Default when undefined | Description                                                                                                            |
| -------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [maxDuration]        | `0` (unlimited)        | Set a timeout (in milliseconds) on requests                                                                            |
| [retryOnTimeout]     | true                   | Whether to retry requests that returned a timeout response                                                             |
| [lastRetryNoTimeout] | true                   | Whether to disable the timeout duration on the last retry (if we assume the service will eventually return a response) |

#### Client retry options

| Name        | Default when undefined | Description                                      |
| ----------- | ---------------------- | ------------------------------------------------ |
| maxAttempts | `5`                    | The number of attempts to make for each request  |
| retryDelay  | `5000` (5 seconds)     | The time (milliseconds) to wait between attempts |

### Rate limit configuration options

| Name  | Default when undefined | Description                              |
| ----- | ---------------------- | ---------------------------------------- |
| get   | `20`                   | Max number of concurrent get requests    |
| total | `-1` (unlimited)       | Shared limit for all concurrent requests |

## Fetch configuration options

| Name                            | Default when undefined | Description                                                         |
| ------------------------------- | ---------------------- | ------------------------------------------------------------------- |
| [include](#fetch-entry-options) | [{ type = ".*" }]      | List of entries to determine what instances to include in the fetch |
| [exclude](#fetch-entry-options) | []                     | List of entries to determine what instances to exclude in the fetch |
| convertUsersIds                 | true                   | When enabled, user IDs will be replaced with user login names       |
| includeGroupMemberships         | false                  | Include group assignments                                           |
| includeProfileMappingProperties | true                   | Include profile mapping properties for profile mapping instances    |

## Fetch entry options

| Name                              | Default when undefined | Description                                                     |
| --------------------------------- | ---------------------- | --------------------------------------------------------------- |
| type                              | ""                     | A regex of the Salto type name to include in the entry          |
| [criteria](#fetch-entry-criteria) |                        | A List of criteria to filter specific instance of certain types |

## Fetch entry criteria

| Name | Default when undefined | Description                                                                |
| ---- | ---------------------- | -------------------------------------------------------------------------- |
| name | .\*                    | A regex used to filter instances by matching the regex to their name value |

### Deploy configuration options

| Name               | Default when undefined | Description                                                     |
| ------------------ | ---------------------- | --------------------------------------------------------------- |
| [omitMissingUsers] | false                  | Configure if to omit users during deploy on types that allow it |
