# serviceplaceholder configuration

## Configuration example

```hcl
serviceplaceholder {
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
        type = "Group" // TODO replace with a service type
      }
    ]
    elemID = {
      myType = {
        parts = [
          {
            fieldName = "label"
          },
          {
            fieldName = "status"
            isReference = true
          }
        ]
        extendsParent = true
      }
    }

  }
}
```

// TODO - all numbers and values should be adjusted, adapter-specific user-facing configuration options should be included as well

## Configuration options

| Name                                    | Default when undefined | Description                                                               |
| --------------------------------------- | ---------------------- | ------------------------------------------------------------------------- |
| [client](#client-configuration-options) | `{}` (no overrides)    | Configuration relating to the client used to interact with the service    |
| [fetch](#fetch-configuration-options)   | `{}` (no overrides)    | Configuration relating to the endpoints that will be queried during fetch |

### Client configuration options

| Name                                             | Default when undefined | Description                                                    |
| ------------------------------------------------ | ---------------------- | -------------------------------------------------------------- |
| [retry](#retry-configuration-options)            | `{}` (no overrides)    | Configuration for retrying on errors                           |
| [rateLimit](#rate-limit-configuration-options)   | `{}` (no overrides)    | Limits on the number of concurrent requests of different types |
| maxRequestsPerMinute                             | 700                    | Limits on the number of requests per minute                    |
| [timeout](#client-timeout-configuration-options) | `{}` (no overrides)    | Configuration for setting request timeouts                     |

#### Client timeout configuration options

| Name               | Default when undefined | Description                                                                                                            |
| ------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| maxDuration        | `0` (unlimited)        | Set a timeout (in milliseconds) on requests                                                                            |
| retryOnTimeout     | true                   | Whether to retry requests that returned a timeout response                                                             |
| lastRetryNoTimeout | true                   | Whether to disable the timeout duration on the last retry (if we assume the service will eventually return a response) |

#### Client retry options

| Name        | Default when undefined | Description                                      |
| ----------- | ---------------------- | ------------------------------------------------ |
| maxAttempts | `5`                    | The number of attempts to make for each request  |
| retryDelay  | `5000`                 | The time (milliseconds) to wait between attempts |

### Rate limit configuration options

| Name  | Default when undefined | Description                              |
| ----- | ---------------------- | ---------------------------------------- |
| get   | `20`                   | Max number of concurrent get requests    |
| total | `-1` (unlimited)       | Shared limit for all concurrent requests |

## Fetch configuration options

| Name                                | Default when undefined | Description                                                         |
| ----------------------------------- | ---------------------- | ------------------------------------------------------------------- |
| [include](#fetch-entry-options)     | [{ type = ".*" }]      | List of entries to determine what instances to include in the fetch |
| [exclude](#fetch-entry-options)     | []                     | List of entries to determine what instances to exclude in the fetch |
| [elemID](#element-id-customization) | {}                     | Allows customizing element IDs for specific types                   |

## Fetch entry options

| Name                              | Default when undefined | Description                                                                  |
| --------------------------------- | ---------------------- | ---------------------------------------------------------------------------- |
| type                              | ""                     | A regular expression used to filter instances by matching to their type name |
| [criteria](#fetch-entry-criteria) |                        | A List of criteria to filter specific instance of certain types              |

## Fetch entry criteria

| Name | Default when undefined | Description                                                               |
| ---- | ---------------------- | ------------------------------------------------------------------------- |
| type | .\*                    | A regex used to filter instances by matching the regex to their type name |

## Element ID customization

| Name                                   | Default when undefined | Description                                                                                                                                       |
| -------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| [parts](#element-id-parts-definitions) | system's default       | All parts definitions will be concatenated to create the element ID                                                                               |
| extendsParent                          | false                  | Whether to concatenate the parent element ID with the current element ID                                                                          |
| delimiter                              | "\_"                   | The delimiter to use to concatenate Elem ID "parts"                                                                                               |
| extendSystemPartsDefinition            | false                  | Set to true to append the user-defined parts with the default system definition. When false, the user definitions override the system definitions |

## Element ID parts definitions

| Name        | Default when undefined | Description                                                                         |
| ----------- | ---------------------- | ----------------------------------------------------------------------------------- |
| fieldName   | system's default       | The instance's field name whose value will be used to create the element ID         |
| isReference | false                  | Set to true if the fieldName is also a Salto reference                              |
| mapping     | undefined              | Allows applying a specific function to fieldName. Options: 'uppercase', 'lowercase' |
