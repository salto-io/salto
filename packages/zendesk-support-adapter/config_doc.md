# Zendesk Support configuration
## Configuration example
```hcl
zendesk_support {
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
    includeTypes = [
      "account_settings",
      "app_installations",
      "apps_owned",
      "automations",
      "brands",
      "business_hours_schedules",
      "custom_roles",
      "dynamic_content_item",
      "groups",
      "locales",
      "macro_categories",
      "macros",
      "macros_actions",
      "macros_definitions",
      "monitored_twitter_handles",
      "oauth_clients",
      "oauth_global_clients",
      "organization_fields",
      "organizations",
      "resource_collections",
      "routing_attribute_definitions",
      "routing_attributes",
      "sharing_agreements",
      "sla_policies",
      "sla_policies_definitions",
      "support_addresses",
      "targets",
      "ticket_fields",
      "ticket_forms",
      "trigger_categories",
      "triggers",
      "user_fields",
      "views",
      "workspaces",
    ]
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
|                                             |   "account_settings",
|                                             |   "app_installations",
|                                             |   "apps_owned",
|                                             |   "automations",
|                                             |   "brands",
|                                             |   "business_hours_schedules",
|                                             |   "custom_roles",
|                                             |   "dynamic_content_item",
|                                             |   "groups",
|                                             |   "locales",
|                                             |   "macro_categories",
|                                             |   "macros",
|                                             |   "macros_actions",
|                                             |   "macros_definitions",
|                                             |   "monitored_twitter_handles",
|                                             |   "oauth_clients",
|                                             |   "oauth_global_clients",
|                                             |   "organization_fields",
|                                             |   "organizations",
|                                             |   "resource_collections",
|                                             |   "routing_attribute_definitions",
|                                             |   "routing_attributes",
|                                             |   "sharing_agreements",
|                                             |   "sla_policies",
|                                             |   "sla_policies_definitions",
|                                             |   "support_addresses",
|                                             |   "targets",
|                                             |   "ticket_fields",
|                                             |   "ticket_forms",
|                                             |   "trigger_categories",
|                                             |   "triggers",
|                                             |   "user_fields",
|                                             |   "views",
|                                             |   "workspaces",
|                                             |  ]                       |
