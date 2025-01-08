# Microsoft Security adapter configuration

## Configuration example

```hcl
microsoft_security {
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
        type = "EntraConditionalAccessPolicy"
      }
    ]
    elemID = {
      EntraApplication = {
        parts = [
          {
            fieldName = "displayName"
          },
          {
            fieldName = "tags"
          }
        ]
      }
    }
  }
  deploy = {
    assignmentFieldsStrategy = {
      IntuneDeviceConfiguration = {
        assignments: {
          strategy = "omit"
        }
      }
      EntraConditionalAccessPolicy = {
        includeApplications = {
          strategy = "fallback"
          fallbackValue = ["All"]
        }
        excludeUsers = {
          strategy = "omit"
        }
      }
    }
  }
}
```

## Configuration options

| Name                                    | Default when undefined | Description                                                               |
| --------------------------------------- | ---------------------- | ------------------------------------------------------------------------- |
| [client](#client-configuration-options) | `{}` (no overrides)    | Configuration relating to the client used to interact with the service    |
| [fetch](#fetch-configuration-options)   | `{}` (no overrides)    | Configuration relating to the endpoints that will be queried during fetch |
| [deploy](#deploy-configuration-options) | `{}` (no overrides)    | Configuration relating to the deployment of changes to the service        |

### Client configuration options

| Name                                             | Default when undefined | Description                                                    |
| ------------------------------------------------ | ---------------------- | -------------------------------------------------------------- |
| [retry](#client-retry-configuration-options)     | `{}` (no overrides)    | Configuration for retrying on errors                           |
| [rateLimit](#rate-limit-configuration-options)   | `{}` (no overrides)    | Limits on the number of concurrent requests of different types |
| maxRequestsPerMinute                             | unlimited              | Limits on the number of requests per minute                    |
| delayPerRequestMS                                | 0                      | Delay waited between each request in milliseconds              |
| useBottleneck                                    | true                   | Flag indicating usage of Bottleneck package for rate limiting  |
| [timeout](#client-timeout-configuration-options) | `{}` (no overrides)    | Configuration for setting request timeouts                     |

#### Client timeout configuration options

| Name               | Default when undefined | Description                                                                                                            |
| ------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| maxDuration        | `0` (unlimited)        | Set a timeout (in milliseconds) on requests                                                                            |
| retryOnTimeout     | true                   | Whether to retry requests that returned a timeout response                                                             |
| lastRetryNoTimeout | true                   | Whether to disable the timeout duration on the last retry (if we assume the service will eventually return a response) |

#### Client retry configuration options

| Name        | Default when undefined | Description                                      |
| ----------- | ---------------------- | ------------------------------------------------ |
| maxAttempts | `5`                    | The number of attempts to make for each request  |
| retryDelay  | `5000`                 | The time (milliseconds) to wait between attempts |

### Rate limit configuration options

| Name  | Default when undefined | Description                              |
| ----- | ---------------------- | ---------------------------------------- |
| get   | `-1` (unlimited)       | Max number of concurrent get requests    |
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

## Deploy configuration options

| Name                                                                   | Default when undefined | Description                                                              |
| ---------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------ |
| [assignmentFieldsStrategy](#assignment-fields-strategy-customizations) | {}                     | Allows customizing the fields of specific assignment types during deploy |

### Assignment fields strategy customizations

Each entry in the configuration object represents a specific instance type name.
The value of each entry defines an object mapping from the field name to a [rule for omitting or replacing the field](#assignment-field-rule-strategy-structure).
If a type is not specified in the configuration, the default behavior is to keep all fields as they are.

Supported types:

- EntraConditionalAccessPolicy
- IntuneApplication
- IntuneApplicationConfigurationManagedApp
- IntuneApplicationConfigurationManagedDevice
- IntuneApplicationProtectionAndroid
- IntuneApplicationProtectionIOS
- IntuneApplicationProtectionWindows
- IntuneApplicationProtectionWindowsInformationProtection
- IntuneDeviceConfiguration
- IntuneDeviceConfigurationSettingCatalog
- IntuneDeviceCompliance
- IntuneFilter
- IntunePlatformScriptLinux
- IntunePlatformScriptMacOS
- IntunePlatformScriptWindows
- IntuneScopeTag

Please refer to the [Intune assignment fields strategy customizations](#intune-assignment-fields-strategy-customizations) section for more information about the supported fields for Intune types, and the [Conditional Access Policy assignment fields strategy customizations](#conditional-access-policy-assignment-fields-strategy-customizations) section for more information about the supported fields for Entra Conditional Access Policy instances.

#### Intune assignment fields strategy customizations

The only field that can be customized for Intune types is `assignments`.
The value of each entry defines a [rule for omitting the field](#assignment-field-rule-strategy-structure).

| Name        | Default when undefined | Description                                        |
| ----------- | ---------------------- | -------------------------------------------------- |
| assignments | {}                     | Configuration for omitting the "assignments" field |

#### Conditional Access Policy assignment fields strategy customizations

Each entry in the configuration object represents a specific field under the "conditions" field of an Entra Conditional Access Policy instance.
The value of each entry defines a [rule for omitting or replacing the field](#assignment-field-rule-strategy-structure).

| Name                     | Default when undefined | Description                                                                                                |
| ------------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| includeApplications      | {}                     | Configuration for omitting or replacing the "conditions.applications.includeApplications" field            |
| excludeApplications      | {}                     | Configuration for omitting or replacing the "conditions.applications.excludeApplications" field            |
| includeServicePrincipals | {}                     | Configuration for omitting or replacing the "conditions.clientApplications.includeServicePrincipals" field |
| excludeServicePrincipals | {}                     | Configuration for omitting or replacing the "conditions.clientApplications.excludeServicePrincipals" field |
| includeUsers             | {}                     | Configuration for omitting or replacing the "conditions.users.includeUsers" field                          |
| excludeUsers             | {}                     | Configuration for omitting or replacing the "conditions.users.excludeUsers" field                          |
| includeGroups            | {}                     | Configuration for omitting or replacing the "conditions.users.includeGroups" field                         |
| excludeGroups            | {}                     | Configuration for omitting or replacing the "conditions.users.excludeGroups" field                         |
| includeRoles             | {}                     | Configuration for omitting or replacing the "conditions.users.includeRoles" field                          |
| excludeRoles             | {}                     | Configuration for omitting or replacing the "conditions.users.excludeRoles" field                          |
| includeDevices           | {}                     | Configuration for omitting or replacing the "conditions.devices.includeDevices" field                      |
| excludeDevices           | {}                     | Configuration for omitting or replacing the "conditions.devices.excludeDevices" field                      |

##### Assignment field rule strategy structure

| Name          | Default when undefined | Description                                                                                                                                                                                                                                |
| ------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| strategy      | undefined              | The strategy to apply for the specified assignment - "omit" or "fallback". If "omit" is set for a required field, the field will be replaced with a value of ["None"]. "fallback" can only be set for EntraConditionalAccessPolicy fields. |
| fallbackValue | undefined              | The value to use as a fallback for the specified assignment field, when the strategy is "fallback".                                                                                                                                        |
