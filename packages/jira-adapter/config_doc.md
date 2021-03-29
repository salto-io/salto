# JIRA adapter configuration
## Configuration example
```hcl
jira {
  client = {
    retry = {
      maxAttempts = 5
      retryDelay = 5000
      retryStrategy = "NetworkError"
    }
    rateLimit = {
      total = -1
      get = 10
    }
  }
}
```

## Configuration options

| Name                                                     | Default when undefined        | Description
| ---------------------------------------------------------| ------------------------------| -----------
| [client](#client-configuration-options)                  | {} (no overrides)             | Configuration relating to the client used to interact with JIRA

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
| retryStrategy  | `NetworkError`         | In which cases to retry. Supported choices: `NetworkError` (retry on network errors), `HttpError` (retry on HTTP 5xx errors), or `HTTPOrNetworkError` (both)

### Rate limit configuration options

| Name                                                        | Default when undefined                           | Description
| ------------------------------------------------------------| -------------------------------------------------| -----------
| get                                                         | `10`                                             | Max number of concurrent get requests
| total                                                       | `-1` (unlimited)                                 | Shared limit for all concurrent requests
