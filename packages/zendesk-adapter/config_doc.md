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
        criteria = {
          name = "name.*"
        }
      },
    ]
    guide = {
      brands = [".*"]
    }
    includeAuditDetails = true
  }
  deploy = {
    defaultMissingUserFallback = "##DEPLOYER##"
  }
}
```

## Configuration options

| Name                                                     | Default when undefined        | Description
| ---------------------------------------------------------| ------------------------------| -----------
| [client](#client-configuration-options)                  | `{}` (no overrides)             | Configuration relating to the client used to interact with Zendesk
| [fetch](#fetch-configuration-options)                    | `{}` (no overrides)             | Configuration relating to the endpoints that will be queried during fetch
| [deploy](#deploy-configuration-options)                  | `{}` (no overrides)             | Configuration relating to the deploy operation

### Client configuration options

| Name                                                          | Default when undefined   | Description
|---------------------------------------------------------------|--------------------------|------------
| [retry](#client-retry-configuration-options)                         | `{}` (no overrides)      | Configuration for retrying on errors
| [rateLimit](#client-rate-limit-configuration-options)                | `{}` (no overrides)      | Limits on the number of concurrent requests of different types
| [maxRequestsPerMinute]                                        | unlimited                | Limits on the number of requests per minute

#### Client retry configuration options

| Name           | Default when undefined | Description
|----------------|------------------------|------------
| maxAttempts    | `5`                    | The number of attempts to make for each request
| retryDelay     | `5000` (5 seconds)     | The time (milliseconds) to wait between attempts

### Client rate limit configuration options

| Name                                                        | Default when undefined                           | Description
| ------------------------------------------------------------| -------------------------------------------------| -----------
| get                                                         | `100`                                             | Max number of concurrent get requests
| total                                                       | `-1` (unlimited)                                 | Shared limit for all concurrent requests

## Fetch configuration options

| Name                            | Default when undefined            | Description
|---------------------------------|-----------------------------------|------------
| [include](#fetch-entry-options) | [{ type = ".*" }]                 | List of entries to determine what instances to include in the fetch
| [exclude](#fetch-entry-options) | []                                | List of entries to determine what instances to exclude in the fetch
| [guide]                         | undefined (Guide will be disabled)| Configuration for defining which brands will be included in Zendesk Guide fetch
| [resolveOrganizationIDs]        | false                             | When enabled, organization IDs will be replaced with organization names
| includeAuditDetails             | false                             | When enabled, changed_at and changed_by information will be added to instances


## Fetch entry options

| Name                                        | Default when undefined            | Description
|---------------------------------------------|-----------------------------------|------------
| type                                        | ""                                | A regex of the Salto type name to include in the entry
| [criteria](#fetch-entry-criteria)             |                                   | A List of criteria to filter specific instance of certain types

### Deploy configuration options

| Name                                                          | Default when undefined   | Description
|---------------------------------------------------------------|--------------------------|------------
| [defaultMissingUserFallback]                                  | ""                       | Configure replacement for missing users during deploy, can be user email or ##DEPLOYER## to fallback to deployer's user 

## Fetch entry criteria

| Name                                        | Default when undefined            | Description
|---------------------------------------------|-----------------------------------|------------
| name                                        | .*                                | A regex used to filter instances by matching the regex to their name value
