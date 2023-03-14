# NetSuite configuration
## Configuration example
```hcl
netsuite {
  fetch = {
    include = {
      types = [
        {
          name = ".*"
        },
      ]
      fileCabinet = [
        "^/SuiteScripts/.*",
        "^/Templates/.*",
      ]
      customRecords = [
        {
          name = "customrecord_.*"
        }
      ]
    }
    exclude = {
      types = [
        {
          name = "savedsearch"
          ids = [".*"]
        }
      ]
      fileCabinet = [
        "^/Web Site Hosting Files.*",
      ]
    }
    fieldsToOmit = [{
      type = "workflow"
      subtype = "workflow_workflowstates_workflowstate"
      fields = [
        "positionx",
        "positiony",
      ]
    }]
  }
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
| [fetch.include](#fetch-include-configuration-options)                                  | Include everything                               | Specifies items to fetch. Items that do not match any of the include criteria will not be fetched
| [fetch.exclude](#fetch-exclude-configuration-options)                                  | [] (Exclude nothing)                             | Specifies items to not fetch. Items that match any of the exclude criteria will not be fetched even if they also match some of the include criteria
| fetch.authorInformation.enable                      | true                    | Whether to fetch the user that made the last change for each element
| fetch.strictInstanceStructure                       | true                    | Whether to omit untyped values
| fetch.fieldsToOmit                                  | [] (omit nothing)       | Specifies fields to omit on fetch
| [client](#sdf-client-configuration-options)         | {} (no overrides)       | Configuration relating to the SDF client used to interact with netsuite
| [suiteAppClient](#salto-suiteapp-client-configuration-options)             | {} (no overrides)       | Configuration relating to the Salto SuiteApp client used to interact with netsuite
| [deploy](#salto-deploy-flags)                       | undefined. set all deploy's flags to their default value        | Configuration deploy optional flags
| deploy.deployReferencedElements                            | false                   | Deployment of a certain configuration element will include all elements referred by it
| deploy.warnOnStaleWorkspaceData                            | false                   | If assigned 'true' runs a validation upon deploy which warns the user if the changes override other changes made in the service since the last fetch
| concurrencyLimit                                    | The higher value between `suiteAppConcurrencyLimit` and `sdfConcurrencyLimit`                    | Limits the max number of concurrent API calls (Both SDF calls and Salto SuiteApp calls). The number should not exceed the concurrency limit enforced by the upstream service.
| [deploy.additionalDependencies](#including--excluding-deploy-dependencies-in-the-sdf-manifest-file)             | {}      | Include / Exclude deploy dependencies in the SDF manifest file

### Including / Excluding deploy dependencies in the SDF manifest file

| Name                           | Default when undefined  | Description
| -------------------------------| ------------------------| -----------
| deploy.additionalDependencies.include.features              | []                      | Feature dependencies list (string[]) to be included in the manifest passed to SDF when deploying
| deploy.additionalDependencies.include.objects               | []                      | Object dependencies list (string[]) to be included in the manifest passed to SDF when deploying
| deploy.additionalDependencies.exclude.features              | []                      | Feature dependencies list (string[]) to be excluded from the manifest passed to SDF when deploying
| deploy.additionalDependencies.exclude.objects               | []                      | Object dependencies list (string[]) to be excluded from the manifest passed to SDF when deploying

Features are included as optional by default. In order to include a required feature add the `":required"` suffix to it.
Example:
```
netsuite {
  deploy = {
    additionalDependencies = {
      include = {
        features = [
          "DEPARTMENTS", // will be added as optional
          "SUBSCRIPTIONBILLING:required", // will be added as required
        ]
      }
    }
  }
}
```

### Fetch include configuration options

| Name                           | Default when undefined  | Description
| -------------------------------| ------------------------| -----------
| types                          | fetch all types         | Specify which types to include on fetch
| fileCabinet                    | fetch all files         | Specify which Files to include on fetch
| customRecords                  | don't fetch custom records | Specify which custom records to include on fetch

### Fetch exclude configuration options
| Name                           | Default when undefined  | Description
| -------------------------------| ------------------------| -----------
| types                          | no types are excluded   | Specify which types to exclude on fetch
| fileCabinet                    | no files are excluded   | Specify which files to exclude on fetch
| customRecords                  | no custom records are excluded | Specify which custom records to exclude on fetch

### SDF Client configuration options

| Name                           | Default when undefined  | Description
| -------------------------------| ------------------------| -----------
| fetchAllTypesAtOnce            | false                   | Attempt to fetch all configuration elements in a single SDF API call
| fetchTypeTimeoutInMinutes      | 4                       | The max number of minutes a single SDF command can run
| maxItemsInImportObjectsRequest | 40                      | Limits the max number of requested items a single import-objects request
| sdfConcurrencyLimit            | 4                       | Limits the max number of concurrent SDF API calls. The number should not exceed the concurrency limit enforced by the upstream service.
| installedSuiteApps             | []                      | The SuiteApps ids to deploy and fetch elements from

### Salto SuiteApp client configuration options

| Name                           | Default when undefined  | Description
| -------------------------------| ------------------------| -----------
| suiteAppConcurrencyLimit            | 4                       | Limits the max number of concurrent Salto SuiteApp API calls. The number should not exceed the concurrency limit enforced by the upstream service.


### Skip list configuration options
| Name                           | Default when undefined  | Description
| -------------------------------| ------------------------| -----------
| types                          | {}                      | A map of a type name to a list of regexes of script ids. Any object whose script id matches any of the regexes of its type will be skipped
| filePaths                      | []                      | A list of regexes of file paths. Any file whose path matches any of the regexes will be skipped
