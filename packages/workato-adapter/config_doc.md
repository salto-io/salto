# Workato configuration
## Configuration example
```hcl
workato {
  client = {
    retry = {
      maxAttempts = 5
      retryDelay = 5000
    }
    rateLimit = {
      total = -1
      get = 10
    }
  }
  fetch = {
    includeTypes = [
      "api_access_profiles",
      "api_clients",
      "api_collections",
      "api_endpoints",
      "connections",
      "folders",
      "properties",
      "recipes",
      "roles",
    ]
    serviceConnectionNames = {
      salesforce = [
        "Salesforce sandbox 1 primary connection",
        "Salesforce sandbox 1 secondary connection",
      ]
      netsuite = [
        "Netsuite sbx",
      ]
    }
  }
}
```

## Configuration options

| Name                                                     | Default when undefined        | Description
| ---------------------------------------------------------| ------------------------------| -----------
| [client](#client-configuration-options)                  | `{}` (no overrides)             | Configuration relating to the client used to interact with Workato
| [fetch](#fetch-configuration-options)                    | `{}` (no overrides)             | Configuration relating to the endpoints that will be queried during fetch

### Client configuration options

| Name                                                          | Default when undefined   | Description
|---------------------------------------------------------------|--------------------------|------------
| [retry](#retry-configuration-options)                         | `{}` (no overrides)      | Configuration for retrying on errors
| [rateLimit](#rate-limit-configuration-options)                | `{}` (no overrides)      | Limits on the number of concurrent requests of different types

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

| Name                                        | Default when undefined   | Description
|---------------------------------------------|--------------------------|------------
| includeTypes                                | [                        | List of types to fetch
|                                             |   "api_access_profiles", |
|                                             |   "api_clients",         |
|                                             |   "api_collections",     |
|                                             |   "api_endpoints",       |
|                                             |   "connections",         |
|                                             |   "folders",             |
|                                             |   "properties",          |
|                                             |   "recipes",             |
|                                             |   "roles",               |
|                                             |  ]                       |
| serviceConnectionNames                      |                          | Mapping from adapter name to workato connection name(s), which is used for resolving the relevant elements into references across multiple adapters in the same environment. Currently salesforce and netsuite are supported
