# Salesforce configuration
## Configuration example
```hcl
salesforce {
  metadataTypesSkippedList = [
    "Report",
    "ReportType",
    "ReportFolder",
    "Dashboard",
    "DashboardFolder",
    "Profile",
    "ForecastingSettings",
  ]
  instancesRegexSkippedList = [
    "^EmailTemplate.MarketoEmailTemplates",
    "^StandardValueSet.AddressCountryCode",
    "^StandardValueSet.AddressStateCode",
  ]
  maxConcurrentApiRequests = {
    retrieve = 3
  }
  maxItemsInRetrieveRequest = 2500
  enableHideTypesInNacls = false
  dataManagement = {
    includeObjects = [
      "SBQQ__CustomAction__c",
      "PricebookEntry",
    ],
    saltoIDSettings = {
      defaultIdFields = [
        "##allMasterDetailFields##",
        "Name",
      ]
      overrides = [
        {
          objectsRegex = "pricebookEntryName"
          idFields = ["Pricebook2Id", "Name"]
        },
        {
          objectsRegex = "SBQQCustomActionName"
          idFields = ["SBQQ__Location__c", "SBQQ__DisplayOrder__c", "Name"]
        },
      ]
    }
  }
  client = {
    polling = {
      interval = 10000
      timeout = 3600000
    }
    deploy = {
      rollbackOnError = true
      ignoreWarnings = true
      purgeOnDelete = false
      checkOnly = false
      testLevel = "NoTestRun"
      runTests = ["Test name", "Other test"]
    }
  }
}
```

## Configuration options

| Name                                                     | Default when undefined        | Description
| ---------------------------------------------------------| ------------------------------| -----------
| metadataTypesSkippedList                                 | [] (fetch all Metadata Types) | Specified types and their instances will not be fetched
| instancesRegexSkippedList                                | [] (fetch all instances)      | Matching instances names will not be fetched
| [maxConcurrentApiRequests](#rate-limit-configuration-options) | { retrieve = 3 }         | Limits the max number of concurrent requests of different types
| maxItemsInRetrieveRequest                                | 2500                          | Limits the max number of requested items a single retrieve request
| enableHideTypesInNacls                                   | false                         | Control whether to generate NaCL files for salesforce types (will be placed under the Types folder)
| [dataManagement](#data-management-configuration-options) | {} (do not manage data)       | Data management configuration 
| [client](#client-configuration-options)                  | {} (no overrides)             | Configuration relating to the client used to interact with salesforce

### Rate limit configuration options

| Name                                                        | Default when undefined                           | Description
| ------------------------------------------------------------| -------------------------------------------------| -----------
| retrieve                                                    | 3                                                | Max number of concurrent retrieve requests
| read                                                        | -1 (unlimited)                                   | Max number of concurrent read requests
| list                                                        | -1 (unlimited)                                   | Max number of concurrent list requests
| total                                                       | -1 (unlimited)                                   | Shared limit for read, retrieve and list

### Data management configuration options

| Name                                                        | Default when undefined                           | Description
| ------------------------------------------------------------| -------------------------------------------------| -----------
| includeObjects                                              | N/A (required when dataManagement is configured) | Data records of matched object names will be fetched
| excludeObjects                                              | []                                               | Data records of matched object names will not be fetched in case they are matched in includeObjects
| allowReferenceTo                                            | []                                               | Data records of matched object names will be fetched only when referenced from other fetched data records
| [saltoIDSettings](#salto-id-settings-configuration-options) | N/A (required when dataManagement is configured) | Configuration for cross environments data record ids management 

#### Salto ID settings configuration options

| Name                                                   | Default when undefined                            | Description
| -------------------------------------------------------| --------------------------------------------------| -----------
| defaultIdFields                                        | N/A (required when saltoIDSettings is configured) | Default fields list for defining the data record's cross environment id
| [overrides](#object-id-settings-configuration-options) | []                                                | Overrides the default id fields for specific objects

#### Object ID settings configuration options

| Name         | Default when undefined                      | Description
| -------------| --------------------------------------------| -----------
| objectsRegex | N/A (required when overrides is configured) | Cross environments ids of the matched object names will be defined by the specified id fields
| idFields     | []                                          | Fields list for defining the data record's cross environment id

### Client configuration options

| Name                                | Default when undefined   | Description
|-------------------------------------|--------------------------|------------
| [polling](#client-polling-options)  | `{}` (no overrides)      | Configuration for polling asynchronous operations (deploy, retrieve, bulk data operations)
| [deploy](#client-deploy-options)    | `{}` (no overrides)      | Deploy options

#### Client polling options

| Name      | Default when undefined | Description
|-----------|------------------------|------------
| interval  | `3000` (3 seconds)       | The interval (milliseconds) at which the client checks wether the operation completed
| timeout   | `5400000` (1.5 hours)    | The timeout (milliseconds) for giving up on a long running operation

#### Client deploy options

| Name            | Default when undefined                                 | Description
|-----------------|--------------------------------------------------------|------------
| rollbackOnError | `true`                                                 | Indicates whether any failure causes a complete rollback or not. Must be set to `true` if deploying to a production org. 
| ignoreWarnings  | `true`                                                 | Indicates whether deployments with warnings complete successfully or not.
| purgeOnDelete   | `false`                                                | If `true`, deleted components aren't stored in the Recycle Bin. Instead, they become immediately eligible for deletion. This option only works in Developer Edition or sandbox orgs. It doesn’t work in production orgs.
| checkOnly       | `false`                                                | If `true`, deploy will run a "validation deploy", changes will not be immediately applied to the service
| testLevel       | `NoTestRun` (development) `RunLocalTests` (production) | Specifies which tests are run as part of a deployment. possible values are: `NoTestRun`, `RunSpecifiedTests`, `RunLocalTests` and `RunAllTestsInOrg`
| runTests        | `[]` (no tests)                                        | A list of Apex tests to run during deployment, must configure `RunSpecifiedTests` in `testLevel` for this option to work


For more details see the DeployOptions section in the [salesforce documentation of the deploy API](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_deploy.htm)
