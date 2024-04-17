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
    handleIdenticalAttachmentConflicts = true
    omitInactive = {
      default = true
      customizations = {
        group = false
      }
    }
  }
  deploy = {
    defaultMissingUserFallback = "##DEPLOYER##"
  }
}
```

## Configuration options

| Name                                    | Default when undefined | Description                                                               |
| --------------------------------------- | ---------------------- | ------------------------------------------------------------------------- |
| [client](#client-configuration-options) | `{}` (no overrides)    | Configuration relating to the client used to interact with Zendesk        |
| [fetch](#fetch-configuration-options)   | `{}` (no overrides)    | Configuration relating to the endpoints that will be queried during fetch |
| [deploy](#deploy-configuration-options) | `{}` (no overrides)    | Configuration relating to the deploy operation                            |

### Client configuration options

| Name                                                  | Default when undefined | Description                                                     |
| ----------------------------------------------------- | ---------------------- | --------------------------------------------------------------- |
| [retry](#client-retry-configuration-options)          | `{}` (no overrides)    | Configuration for retrying on errors                            |
| [rateLimit](#client-rate-limit-configuration-options) | `{}` (no overrides)    | Limits on the number of concurrent requests of different types  |
| [maxRequestsPerMinute]                                | unlimited              | Limits on the number of requests per minute                     |
| [timeout](#client-timeout-configuration-options)      | `{}` (no overrides)    | Configuration for setting request timeouts                      |
| unassociatedAttachmentChunkSize                       | `50`                   | chunk size for the creation of unassociated article attachments |

#### Client timeout configuration options

| Name                 | Default when undefined | Description                                                                                                            |
| -------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [maxDuration]        | `5000` (5 seconds)     | Set a timeout (in milliseconds) on requests (setting `0` is unlimited)                                                 |
| [retryOnTimeout]     | true                   | Whether to retry requests that returned a timeout response                                                             |
| [lastRetryNoTimeout] | true                   | Whether to disable the timeout duration on the last retry (if we assume the service will eventually return a response) |

#### Client retry configuration options

| Name        | Default when undefined | Description                                      |
| ----------- | ---------------------- | ------------------------------------------------ |
| maxAttempts | `5`                    | The number of attempts to make for each request  |
| retryDelay  | `5000` (5 seconds)     | The time (milliseconds) to wait between attempts |

### Client rate limit configuration options

| Name  | Default when undefined | Description                              |
| ----- | ---------------------- | ---------------------------------------- |
| get   | `100`                  | Max number of concurrent get requests    |
| total | `-1` (unlimited)       | Shared limit for all concurrent requests |

## Fetch configuration options

| Name                                  | Default when undefined             | Description                                                                                                                                                            |
| ------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [include](#fetch-entry-options)       | [{ type = ".*" }]                  | List of entries to determine what instances to include in the fetch                                                                                                    |
| [exclude](#fetch-entry-options)       | []                                 | List of entries to determine what instances to exclude in the fetch                                                                                                    |
| [guide](#guide-configuration-options) | undefined (Guide will be disabled) | Configuration for defining options for Zendesk Guide fetch                                                                                                             |
| [resolveOrganizationIDs]              | false                              | When enabled, organization IDs will be replaced with organization names                                                                                                |
| [resolveUserIDs]                      | true                               | When enabled, user IDs will be replaced with user emails                                                                                                               |
| includeAuditDetails                   | false                              | When enabled, changed_by information will be added to instances                                                                                                        |
| handleIdenticalAttachmentConflicts    | false                              | When enabled, one attachment will be kept from each set of identical attachments (having the same hash) associated with the same article                               |
| extractReferencesFromFreeText         | false                              | When enabled, convert ids in zendesk links in string values to salto references                                                                                        |
| convertJsonIdsToReferences            | false                              | When enabled, If a field is a json with an 'id' field, convert its value to a reference                                                                                |
| omitInactive                          | true                               | When enabled, Inactive instances will be omitted from the fetch. This option support default value and specific types can be overridden using the customizations field |
| omitTicketStatusTicketField           | false                              | When enabled, Custom Ticket Status will be omitted from the fetch.                                                                                                     |

## Fetch entry options

| Name                              | Default when undefined | Description                                                     |
| --------------------------------- | ---------------------- | --------------------------------------------------------------- |
| type                              | ""                     | A regex of the Salto type name to include in the entry          |
| [criteria](#fetch-entry-criteria) |                        | A List of criteria to filter specific instance of certain types |

## Guide configuration options

| Name                                    | Default when undefined                 | Description                                                                     |
| --------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------- |
| brands                                  | []                                     | Configuration for defining which brands will be included in Zendesk Guide fetch |
| [themes](#themes-configuration-options) | undefined (Themes will not be fetched) | Configuration for defining fetching of Zendesk Guide Themes                     |

## Themes configuration options

| Name                                          | Default when undefined           | Description                                                             |
| --------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------- |
| brands                                        | []                               | Configuration for defining which brands will have their Themes fetched  |
| [referenceOptions](#themes-reference-options) | { enableReferenceLookup: false } | Configuration for defining reference parsing and extraction from Themes |

## Themes reference options

| Name                                                                              | Default when undefined | Description                                                             |
| --------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------- |
| enableReferenceLookup                                                             | false                  | When enabled, references will be extracted from Themes files            |
| [javascriptReferenceLookupStrategy](#themes-javascript-reference-lookup-strategy) | undefined              | Configuration for defining reference parsing and extraction from Themes |

## Themes Javascript Reference Lookup Strategy

| Name               | Default when undefined | Description                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------ | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| strategy           | `varNamePrefix`        | The reference strategy for Javascript files - either `varNamePrefix` or `numericValues`.                                                                                                                                                                                                                                                                                                     |
| prefix             | `PREFIX_`              | When matched with the `varNamePrefix` option, parses only variable definitions that are prefixed by `prefix`, and tries to match all digit sequences within the variable initialization as references. For example, with the default value, the Javascript line `var PREFIX_my_article_id = 12345` will extract the digit `12345`, but `var my_article_id = 12345` will not extract anything |
| minimumDigitAmount | undefined              | When matched with the `numericValues` option, extracts all digits sequences with at least `minimumDigitAmount` digits - and tries to match them as references                                                                                                                                                                                                                                |

### Deploy configuration options

| Name                         | Default when undefined | Description                                                                                                             |
| ---------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [defaultMissingUserFallback] | ""                     | Configure replacement for missing users during deploy, can be user email or ##DEPLOYER## to fallback to deployer's user |
| [createMissingOrganizations] | false                  | When enabled with resolveOrganizationIDs flag , missing organizations will be created during deploy.                    |

## Fetch entry criteria

| Name      | Default when undefined | Description                                                                             |
| --------- | ---------------------- | --------------------------------------------------------------------------------------- |
| name      | .\*                    | A regex used to filter instances by matching the regex to their name value              |
| key       | .\*                    | A regex used to filter instances by matching the regex to the value of their key field  |
| raw_title | .\*                    | A regex used to filter instances by matching the regex to their raw_title value         |
| title     | .\*                    | A regex used to filter instances by matching the regex to their title value             |
| type      | .\*                    | A regex used to filter instances by matching the regex to the value of their type field |
