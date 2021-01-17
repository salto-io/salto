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
| typesToSkip                                         | [] (fetch all types)    | Specified types that their instances will not be fetched from the service
| filePathRegexSkipList                               | [] (fetch all files)    | Matching file-cabinet file paths will not be fetched from the service
| deployReferencedElements                            | false                   | Deployment of a certain configuration element will include all elements referred by it
| [client](#client-configuration-options)             | {} (no overrides)       | Configuration relating to the client used to interact with netsuite
| [fetchTarget](#fetch-target-configuration-options)  | undefined (fetch all)   | A query to determine what elements to fetch from the service

### Client configuration options

| Name                           | Default when undefined  | Description
| -------------------------------| ------------------------| -----------
| fetchAllTypesAtOnce            | false                   | Attempt to fetch all configuration elements in a single SDF API call
| fetchTypeTimeoutInMinutes      | 20                      | The max number of minutes a single type's fetch can run
| maxItemsInImportObjectsRequest | 30                      | Limits the max number of requested items a single import-objects request
| sdfConcurrencyLimit            | 4                       | Limits the max number of concurrent SDF API calls. The number should not exceed the concurrency limit enforced by the upstream service.

### Fetch Target configuration options
| Name                           | Default when undefined  | Description
| -------------------------------| ------------------------| -----------
| types                          | {}                      | A map of a type name to a list of regexes of script ids. Any object whose script id matches any of the regexes of its type will be fetched
| filePaths                      | []                      | A list of regexes of file paths. Any file whose path matches any of the regexes will be fetched
