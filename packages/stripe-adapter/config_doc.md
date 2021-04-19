# Stripe configuration
## Configuration example
```hcl
stripe {
  client = {
    retry = {
      maxAttempts = 5
      retryDelay = 5000
      retryStrategy = "NetworkError"
    }
    rateLimit = {
      total = -1
      get = 25
    }
  }
  fetch = {
    includeTypes = [
        "v1__country_specs",
        "v1__coupons",
        "v1__plans",
        "v1__prices",
        "v1__products",
        "v1__reporting__report_types",
        "v1__tax_rates",
        "v1__webhook_endpoints",
    ]
  }
}
```

## Configuration options

| Name                                                     | Default when undefined        | Description
| ---------------------------------------------------------| ------------------------------| -----------
| [client](#client-configuration-options)                  | `{}` (no overrides)             | Configuration relating to the client used to interact with Stripe
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
| retryStrategy  | `NetworkError`         | In which cases to retry. Supported choices: `NetworkError` (retry on network errors), `HttpError` (retry on HTTP 5xx errors), or `HTTPOrNetworkError` (both)

### Rate limit configuration options

| Name                                                        | Default when undefined                           | Description
| ------------------------------------------------------------| -------------------------------------------------| -----------
| get                                                         | `25`                                             | Max number of concurrent get requests

| total                                                       | `-1` (unlimited)                                 | Shared limit for all concurrent requests

## Fetch configuration options

| Name                                        | Default when undefined          | Description
|---------------------------------------------|---------------------------------|------------
| includeTypes                                | [                               | List of types to fetch
|                                             |   "v1__country_specs",          |
|                                             |   "v1__coupons",                |
|                                             |   "v1__plans",                  |
|                                             |   "v1__prices",                 |
|                                             |   "v1__products",               |
|                                             |   "v1__reporting__report_types",|
|                                             |   "v1__tax_rates",              |
|                                             |   "v1__webhook_endpoints",      |
|                                             |  ]                              |
