# Zendesk configuration
## Configuration example
```hcl
zendesk {
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
        type = "organization"
      },
    ]
    guide = {
      brands = [".*"]
    }
  }
}
```

## Configuration options

| Name                                                     | Default when undefined        | Description
| ---------------------------------------------------------| ------------------------------| -----------
| [client](#client-configuration-options)                  | `{}` (no overrides)             | Configuration relating to the client used to interact with Zendesk
| [fetch](#fetch-configuration-options)                    | `{}` (no overrides)             | Configuration relating to the endpoints that will be queried during fetch

### Client configuration options

| Name                                                          | Default when undefined   | Description
|---------------------------------------------------------------|--------------------------|------------
| [retry](#retry-configuration-options)                         | `{}` (no overrides)      | Configuration for retrying on errors
| [rateLimit](#rate-limit-configuration-options)                | `{}` (no overrides)      | Limits on the number of concurrent requests of different types
| [maxRequestsPerMinute]                                        | unlimited                | Limits on the number of requests per minute

#### Client retry options

| Name           | Default when undefined | Description
|----------------|------------------------|------------
| maxAttempts    | `5`                    | The number of attempts to make for each request
| retryDelay     | `5000` (5 seconds)     | The time (milliseconds) to wait between attempts

### Rate limit configuration options

| Name                                                        | Default when undefined                           | Description
| ------------------------------------------------------------| -------------------------------------------------| -----------
| get                                                         | `10`                                             | Max number of concurrent get requests
| total                                                       | `-1` (unlimited)                                 | Shared limit for all concurrent requests

## Fetch configuration options

| Name                                        | Default when undefined            | Description
|---------------------------------------------|-----------------------------------|------------
| [include](#fetch-entry-options)             | [{ type = ".*" }]                 | List of entries to determine what instances to include in the fetch
| [exclude](#fetch-entry-options)             | []                                | List of entries to determine what instances to exclude in the fetch
| [guide](#fetch-entry-options)               | { brands = [] }                   | Configuration for defining which brands will be included in Zendesk Guide fetch

## Fetch entry options

| Name                                        | Default when undefined            | Description
|---------------------------------------------|-----------------------------------|------------
| type                                        | ""                                | A regex of the Salto type name to include in the entry
