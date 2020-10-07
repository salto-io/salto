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
  deployReferencedElements = false
  sdfConcurrencyLimit = 4
}
```

## Configuration options

| Name                     | Default when undefined  | Description
| -------------------------| ------------------------| -----------
| typesToSkip              | [] (fetch all types)    | Types to skip their instances deployment and fetch
| filePathRegexSkipList    | [] (fetch all files)    | Regular Expressions of file paths to skip their fetch
| fetchAllTypesAtOnce      | false                   | Attempt to fetch all customization in a single SDF API call
| deployReferencedElements | false                   | Deploy also the salto elements that are referenced by the deployed elements
| sdfConcurrencyLimit      | 4                       | Control the number of concurrent API calls to trigger against SDF integration. Avoid setting it to be greater than your integration's concurrency limit (relevant if fetchAllTypesAtOnce is set to false)
