# Okta adapter configuration
## Configuration example
```hcl
okta {
  client = {
    retry = {
      maxAttempts = 5
      retryDelay = 5000
      retryStrategy = "NetworkError"
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
        type = "Webhook"
        criteria = {
          name = "name.*"
        }
      }
    ]
  }
}
```

## Configuration options

| Name                                                     | Default when undefined        | Description
| ---------------------------------------------------------| ------------------------------| -----------
| [client](#client-configuration-options)                  | `{}` (no overrides)             | Configuration relating to the client used to interact with Okta
| [fetch](#fetch-configuration-options)                    | `{}` (no overrides)             | Configuration relating to the endpoints that will be queried during fetch
| [masking](#masking-configuration-options)                | `{}` (mask nothing)           | Configuration to mask sensitive data from the NaCls

### Client configuration options

| Name                                                          | Default when undefined   | Description
|---------------------------------------------------------------|--------------------------|------------
| [retry](#retry-configuration-options)                         | `{}` (no overrides)      | Configuration for retrying on errors
| [rateLimit](#rate-limit-configuration-options)                | `{}` (no overrides)      | Limits on the number of concurrent requests of different types
| usePrivateAPI                                                 | true                     | Whether to use Okta Private API when fetching and deploying changes

#### Client retry options

| Name           | Default when undefined | Description
|----------------|------------------------|------------
| maxAttempts    | `5`                    | The number of attempts to make for each request
| retryDelay     | `5000` (5 seconds)     | The time (milliseconds) to wait between attempts
| retryStrategy  | `NetworkError`         | In which cases to retry. Supported choices: `NetworkError` (retry on network errors), `HttpError` (retry on HTTP 5xx errors), or `HTTPOrNetworkError` (both)

### Rate limit configuration options

| Name                                                        | Default when undefined                           | Description
| ------------------------------------------------------------| -------------------------------------------------| -----------
| get                                                         | `20`                                             | Max number of concurrent get requests
| total                                                       | `-1` (unlimited)                                 | Shared limit for all concurrent requests

## Fetch configuration options

| Name                                        | Default when undefined            | Description
|---------------------------------------------|-----------------------------------|------------
| [include](#fetch-entry-options)               | [{ type = ".*" }]                 | List of entries to determine what instances to include in the fetch
| [exclude](#fetch-entry-options)               | []                                | List of entries to determine what instances to exclude in the fetch
| fallbackToInternalId                        | false                             | Whether to add the internal ids to the instance name when the name is not unique among the instances of that type

## Masking configuration options
| Name                                        | Default when undefined            | Description
|---------------------------------------------|-----------------------------------|------------
| automationHeaders                           | []                                | List of regexes of header keys in Automations to mask their values
| secretRegexps                               | []                                | List of regexes of strings to mask all across the workspace

## Fetch entry options

| Name                                        | Default when undefined            | Description
|---------------------------------------------|-----------------------------------|------------
| type                                        | ""                                | A regex of the Salto type name to include in the entry
| [criteria](#fetch-entry-criteria)             |                                   | A List of criteria to filter specific instance of certain types

## Fetch entry criteria

| Name                                        | Default when undefined            | Description
|---------------------------------------------|-----------------------------------|------------
| name                                        | .*                                | A regex used to filter instances by matching the regex to their name value
