# NetSuite configuration
## Configuration example
```hcl
netsuite {
  skipList = {
    types = {
      savedsearch = [".*"]
    }
    filePaths = [
      "^/Web Site Hosting Files.*",
    ]
  }
  deployReferencedElements = false
  concurrencyLimit = 5
  client = {
    fetchAllTypesAtOnce = false
    fetchTypeTimeoutInMinutes = 4
    maxItemsInImportObjectsRequest = 40
    sdfConcurrencyLimit = 4
  }
  suiteAppClient = {
   suiteAppConcurrencyLimit = 4 
  }
}
```

## Configuration options

| Name                                                | Default when undefined  | Description
| ----------------------------------------------------| ------------------------| -----------
| [skipList](#skip-list-configuration-options)        | {} (skip nothing)       | Specified items to skip when fetching from the service
| deployReferencedElements                            | false                   | Deployment of a certain configuration element will include all elements referred by it
| [client](#sdf-client-configuration-options)         | {} (no overrides)       | Configuration relating to the SDF client used to interact with netsuite
| [suiteAppClient](#salto-suiteapp-client-configuration-options)             | {} (no overrides)       | Configuration relating to the Salto SuiteApp client used to interact with netsuite
| concurrencyLimit                                    | The higher value between `suiteAppConcurrencyLimit` and `sdfConcurrencyLimit`                    | Limits the max number of concurrent API calls (Both SDF calls and Salto SuiteApp calls). The number should not exceed the concurrency limit enforced by the upstream service.

### SDF Client configuration options

| Name                           | Default when undefined  | Description
| -------------------------------| ------------------------| -----------
| fetchAllTypesAtOnce            | false                   | Attempt to fetch all configuration elements in a single SDF API call
| fetchTypeTimeoutInMinutes      | 4                       | The max number of minutes a single SDF command can run
| maxItemsInImportObjectsRequest | 40                      | Limits the max number of requested items a single import-objects request
| sdfConcurrencyLimit            | 4                       | Limits the max number of concurrent SDF API calls. The number should not exceed the concurrency limit enforced by the upstream service.

### Salto SuiteApp client configuration options

| Name                           | Default when undefined  | Description
| -------------------------------| ------------------------| -----------
| suiteAppConcurrencyLimit            | 4                       | Limits the max number of concurrent Salto SuiteApp API calls. The number should not exceed the concurrency limit enforced by the upstream service.


### Skip list configuration options
| Name                           | Default when undefined  | Description
| -------------------------------| ------------------------| -----------
| types                          | {}                      | A map of a type name to a list of regexes of script ids. Any object whose script id matches any of the regexes of its type will be skipped
| filePaths                      | []                      | A list of regexes of file paths. Any file whose path matches any of the regexes will be skipped