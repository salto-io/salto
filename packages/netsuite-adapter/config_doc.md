# NetSuite configuration
## Configuration example
```hcl
netsuite {
  typesToSkip = [
    "savedsearch",
  ]
  filePathRegexSkipList = [
    "^/Web Site Hosting Files.*",
  ]
  deployReferencedElements = false
  client = {
    fetchAllTypesAtOnce = false
    fetchTypeTimeoutInMinutes = 20
    maxItemsInImportObjectsRequest = 30
    sdfConcurrencyLimit = 4
  }
}
```

## Configuration options

| Name                                                | Default when undefined  | Description
| ----------------------------------------------------| ------------------------| -----------
| [skipList](#skip-list-configuration-options)        | {} (skip nothing)       | Specified items to skip when fetching from the service
| deployReferencedElements                            | false                   | Deployment of a certain configuration element will include all elements referred by it
| [client](#client-configuration-options)             | {} (no overrides)       | Configuration relating to the client used to interact with netsuite

### Client configuration options

| Name                           | Default when undefined  | Description
| -------------------------------| ------------------------| -----------
| fetchAllTypesAtOnce            | false                   | Attempt to fetch all configuration elements in a single SDF API call
| fetchTypeTimeoutInMinutes      | 20                      | The max number of minutes a single type's fetch can run
| maxItemsInImportObjectsRequest | 30                      | Limits the max number of requested items a single import-objects request
| sdfConcurrencyLimit            | 4                       | Limits the max number of concurrent SDF API calls. The number should not exceed the concurrency limit enforced by the upstream service.

### Skip list configuration options
| Name                           | Default when undefined  | Description
| -------------------------------| ------------------------| -----------
| types                          | {}                      | A map of a type name to a list of regexes of script ids. Any object whose script id matches any of the regexes of its type will be skipped
| filePaths                      | []                      | A list of regexes of file paths. Any file whose path matches any of the regexes will be skipped