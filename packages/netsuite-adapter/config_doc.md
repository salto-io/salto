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
  fetchAllTypesAtOnce = false
  fetchTypeTimeoutInMinutes = 12
  deployReferencedElements = false
  sdfConcurrencyLimit = 4
}
```

## Configuration options

| Name                      | Default when undefined  | Description
| ------------------------- | ------------------------| -----------
| typesToSkip               | [] (fetch all types)    | Specified types that their instances will not be fetched from the service
| filePathRegexSkipList     | [] (fetch all files)    | Matching file-cabinet file paths will not be fetched from the service
| fetchAllTypesAtOnce       | false                   | Attempt to fetch all configuration elements in a single SDF API call
| fetchTypeTimeoutInMinutes | 12                      | Limits the time a single type's fetch can run
| deployReferencedElements  | false                   | Deployment of a certain configuration element will include all elements referred by it
| sdfConcurrencyLimit       | 4                       | Limits the max number of concurrent SDF API calls. The number should not exceed the concurrency limit enforced by the upstream service.
