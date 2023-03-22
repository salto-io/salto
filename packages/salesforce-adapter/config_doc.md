# Salesforce configuration
## Configuration example
```hcl
salesforce {
  maxItemsInRetrieveRequest = 2500
  client = {
    polling = {
      interval = 10000
      deployTimeout = 3600000
      fetchTimeout = 1800000
    }
    deploy = {
      rollbackOnError = true
      ignoreWarnings = true
      purgeOnDelete = false
      checkOnly = false
      testLevel = "NoTestRun"
      runTests = ["Test name", "Other test"]
      deleteBeforeUpdate = false
    }
    retry = {
      maxAttempts = 5
      retryDelay = 5000
      retryStrategy = "NetworkError"
      timeout = 900000
    }
    maxConcurrentApiRequests = {
      total = 100
      retrieve = 3
      read = -1
      list = -1
      query = 4
      describe = -1
      deploy = -1
    }
  }
  fetch = {
    metadata = {
      exclude = [
        {
          metadataType = "Report"
        },
        {
          metadataType = "ReportType"
        },
        {
          metadataType = "ReportFolder"
        },
        {
          metadataType = "Dashboard"
        },
        {
          metadataType = "DashboardFolder"
        },
        {
          metadataType = "Profile"
        },
        {
          metadataType = "ForecastingSettings"
        },
        {
          metadataType = "PermissionSet"
        },
        {
          metadataType = "CustomObjectTranslation"
        },
        {
          metadataType = "EmailTemplate"
        },
        {
          metadataType = "StandardValueSet"
          name = "AddressCountryCode.*"
        },
        {
          metadataType = "StandardValueSet"
          name = "AddressStateCode.*"
        },
      ]
    }
    data = {
      includeObjects = [
        ".*SBQQ__CustomAction__c.*",
        ".*PricebookEntry.*",
      ]
      saltoIDSettings = {
        defaultIdFields = [
          "##allMasterDetailFields##",
          "Name",
        ]
        overrides = [
          {
            objectsRegex = ".*pricebookEntryName.*"
            idFields = [
              "Pricebook2Id",
              "Name",
            ]
          },
          {
            objectsRegex = ".*SBQQCustomActionName.*"
            idFields = [
              "SBQQ__Location__c",
              "SBQQ__DisplayOrder__c",
              "Name",
            ]
          },
        ]
      }
    }
    fetchAllCustomSettings = false
  }
}
```

## Configuration options

| Name                                           | Default when undefined | Description                                                                       |
|------------------------------------------------|------------------------|-----------------------------------------------------------------------------------|
| maxItemsInRetrieveRequest                      | 2500                   | Limits the max number of requested items a single retrieve request                |
| [fetch](#fetch-configuration-options)          |                        | Fetch configuration                                                               |
| [client](#client-configuration-options)        | {} (no overrides)      | Configuration relating to the client used to interact with salesforce             |
| [validators](#validator-configuration-options) | {} (all enabled)       | Configuration for choosing which validators will be applied to deploy plans       |
| enumFieldPermissions                           | true                  | Change the FieldPermission values to be enum instead of an Object with references |

## Fetch configuration options

| Name                                           | Default when undefined  | Description                                                                                                                                                                                                           |
|------------------------------------------------|-------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| [metadata](#metadata-configuration-options)    | Fetch all metdata       | Specified the metadata fetch                                                                                                                                                                                          |
| [data](#data-management-configuration-options) | {} (do not manage data) | Data management configuration object names will not be fetched in case they are matched in includeObjects                                                                                                             |
| fetchAllCustomSettings                         | true                    | Whether to fetch all the custom settings instances. When false, it is still possible to choose specific custom settings instances via the `data` option                                                               |
| [optionalFeatures](#optional-features)         | {} (all enabled)        | Granular control over which features are enabled in the adapter, by default all features are enabled in order to get the most information. can be used to turn off features that cause problems until they are solved |
| maxInstancesPerType                            | 5000                    | Do not fetch metadataTypes and CustomObjects with more instances than this number, and add those to the exclude lists                                                                                                 |
| preferActiveFlowVersions                       | false                   | When set to false, flows' latest version will be fetched. Otherwise, flows' active version will be fetched if exists                                                                                                  |

## Metadata configuration options

| Name                           | Default when undefined       | Description                                                                                                                                                     |
|--------------------------------|------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| [include](#metadata-query)     | Include everything           | Specified the metadata to fetch. Metadata that does not match any of the include criteria will not be fetched                                                   |
| [exclude](#metadata-query)     | [] (Exclude nothing)         | Specified the metadata to not fetch. Metadata that matches any of the exclude criteria will not be fetched even if it also matches some of the include criteria |
| objectsToSeperateFieldsToFiles | [] (Don't split any objects) | Specified a list of objects which will be stored as one field per nacl file                                                                                     |

## Metadata Query
| Name         | Default when undefined | Description                                                    |
|--------------|------------------------|----------------------------------------------------------------|
| namespace    | ".*" (All namespaces)  | A regular expression of a namespace to query with              |
| metadataType | ".*" (All types)       | A regular expression of a metadata type to query with          |
| name         | ".*" (All names)       | A regular expression of a metadata instance name to query with |

## Optional Features

| Name              | Default when undefined | Description                                                                                                                            |
|-------------------|------------------------|----------------------------------------------------------------------------------------------------------------------------------------|
| extraDependencies | true                   | Find additional dependencies between configuration elements by using the salesforce tooling API                                        |
| elementsUrls      | true                   | Populate URLs for your salesforce configuration elements and enable quick navigation from Salto to the corresponding salesforce screen |
| addMissingIds     | true                   | Populate Salesforce internal ids for a few types that require special handling                                                         |
| profilePaths      | true                   | Update file names for profiles whose API name is different from their display name                                                     |
| authorInformation | true                   | Populate Salesforce author information about who and when last changed Salesforce configuration elements.                              |
| describeSObjects  | true                   | Fetch additional information about CustomObjects from the soap API                                                                     |

### Data management configuration options

| Name                                                        | Default when undefined                           | Description                                                                                               |
|-------------------------------------------------------------|--------------------------------------------------|-----------------------------------------------------------------------------------------------------------|
| includeObjects                                              | N/A (required when dataManagement is configured) | Data records of matched object names will be fetched                                                      |
| excludeObjects                                              | []                                               | Data records of matched object names will not be fetched in case they are matched in includeObjects       |
| allowReferenceTo                                            | []                                               | Data records of matched object names will be fetched only when referenced from other fetched data records |
| [saltoIDSettings](#salto-id-settings-configuration-options) | N/A (required when dataManagement is configured) | Configuration for cross environments data record ids management                                           |

#### Salto ID settings configuration options

| Name                                                   | Default when undefined                            | Description                                                             |
|--------------------------------------------------------|---------------------------------------------------|-------------------------------------------------------------------------|
| defaultIdFields                                        | N/A (required when saltoIDSettings is configured) | Default fields list for defining the data record's cross environment id |
| [overrides](#object-id-settings-configuration-options) | []                                                | Overrides the default id fields for specific objects                    |

#### Object ID settings configuration options

| Name         | Default when undefined                      | Description                                                                                   |
|--------------|---------------------------------------------|-----------------------------------------------------------------------------------------------|
| objectsRegex | N/A (required when overrides is configured) | Cross environments ids of the matched object names will be defined by the specified id fields |
| idFields     | []                                          | Fields list for defining the data record's cross environment id                               |

### Client configuration options

| Name                                                          | Default when undefined                                | Description                                                                                        |
|---------------------------------------------------------------|-------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| [polling](#client-polling-options)                            | `{}` (no overrides)                                   | Configuration for polling asynchronous operations (deploy, retrieve, bulk data operations)         |
| [deploy](#client-deploy-options)                              | `{}` (no overrides)                                   | Deploy options                                                                                     |
| [retry](#retry-configuration-options)                         | `{}` (no overrides)                                   | Configuration for retrying on errors                                                               |
| [maxConcurrentApiRequests](#rate-limit-configuration-options) | `{}` (no overrides)                                   | Limits on the number of concurrent requests of different types                                     |
| [dataRetry](#client-data-retry-options)                       | `{}` (no overrides)                                   | Configuration for retrying on specific errors regarding data objects (for custom object instances) |
| [readMetadataChunkSize](#read-metadata-chunk-size)            | 10 except for Profile and PermissionSet (which are 1) | Configuration for specifing the size of the chunk in readMetadata                                  |

#### Client polling options

| Name          | Default when undefined | Description                                                                           |
|---------------|------------------------|---------------------------------------------------------------------------------------|
| interval      | `3000` (3 seconds)     | The interval (milliseconds) at which the client checks wether the operation completed |
| deployTimeout | `5400000` (1.5 hours)  | The timeout (milliseconds) on deploy operations                                       |
| fetchTimeout  | `1800000` (30 minutes) | The timeout (milliseconds) on fetch operations                                        |

#### Client deploy options

| Name               | Default when undefined                                 | Description                                                                                                                                                                                                              |
|--------------------|--------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| rollbackOnError    | `true`                                                 | Indicates whether any failure causes a complete rollback or not. Must be set to `true` if deploying to a production org.                                                                                                 |
| ignoreWarnings     | `true`                                                 | Indicates whether deployments with warnings complete successfully or not.                                                                                                                                                |
| purgeOnDelete      | `false`                                                | If `true`, deleted components aren't stored in the Recycle Bin. Instead, they become immediately eligible for deletion. This option only works in Developer Edition or sandbox orgs. It doesn’t work in production orgs. |
| checkOnly          | `false`                                                | If `true`, deploy will run a "validation deploy", changes will not be immediately applied to the service                                                                                                                 |
| testLevel          | `NoTestRun` (development) `RunLocalTests` (production) | Specifies which tests are run as part of a deployment. possible values are: `NoTestRun`, `RunSpecifiedTests`, `RunLocalTests` and `RunAllTestsInOrg`                                                                     |
| runTests           | `[]` (no tests)                                        | A list of Apex tests to run during deployment, must configure `RunSpecifiedTests` in `testLevel` for this option to work                                                                                                 |
| deleteBeforeUpdate | `false`                                                | If `true`, deploy will make deletions before any other deployed change                                                                                                                                                   |

For more details see the DeployOptions section in the [salesforce documentation of the deploy API](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_deploy.htm)

#### Client retry options

| Name          | Default when undefined | Description                                                                                                                                                  |
|---------------|------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------|
| maxAttempts   | `5`                    | The number of attempts to make for each request                                                                                                              |
| retryDelay    | `5000` (5 seconds)     | The time (milliseconds) to wait between attempts                                                                                                             |
| retryStrategy | `NetworkError`         | In which cases to retry. Supported choices: `NetworkError` (retry on network errors), `HttpError` (retry on HTTP 5xx errors), or `HTTPOrNetworkError` (both) |
| timeout       | `900000` (15 minutes)  | The timeout (milliseconds) on each request retry                                                                                                             |

### Rate limit configuration options

| Name     | Default when undefined | Description                                                                                                          |
|----------|------------------------|----------------------------------------------------------------------------------------------------------------------|
| retrieve | `3`                    | Max number of concurrent retrieve requests (retrieve)                                                                |
| read     | `-1` (unlimited)       | Max number of concurrent read requests (readMetadata)                                                                |
| list     | `-1` (unlimited)       | Max number of concurrent list requests (listMetadataObjects)                                                         |
| query    | `4`                    | Max number of concurrent SOQL query requests (query, queryMore)                                                      |
| describe | `-1` (unlimited)       | Max number of concurrent describe requests (listMetadataTypes, describeMetadataType, listSObjects, describeSObjects) |
| deploy   | `-1` (unlimited)       | Max number of concurrent deploy requests (deploy, bulkLoadOperation)                                                 |
| total    | `100` (unlimited)      | Global limit of concurrent api requests                                                                              |

### Client data retry options

| Name              | Default when undefined                                  | Description                           |
|-------------------|---------------------------------------------------------|---------------------------------------|
| maxAttempts       | `5`                                                     | Max attempts to deploy data instances |
| retryDelay        | `1000`                                                  | Delay (in millis) between each retry  |
| retryableFailures | `FIELD_CUSTOM_VALIDATION_EXCEPTION, UNABLE_TO_LOCK_ROW` | Error messages for which to retry     |
| 

### Read metadata chunk size
| Name      | Default when undefined                 | Description                                  |
|-----------|----------------------------------------|----------------------------------------------|
| default   | `10`                                   | Default value for chunk size in readMetadata |
| overrides | Profile and PermissionSet are set to 1 | Chunk size for specific metadata types       |

## Validator Configuration Options
| Name                  | Default when undefined | Description                                                                                       |
|-----------------------|------------------------|---------------------------------------------------------------------------------------------------|
| managedPackage        | true                   | Disallow changes to objects and fields that are part of a managed package                         |
| picklistStandardField | true                   | It is forbidden to modify a picklist on a standard field. Only StandardValueSet is allowed        |
| customObjectInstances | true                   | Validate permissions of creating / update data records                                            |
| unknownField          | true                   | Disallow deploying an unknown field type                                                          |
| customFieldType       | true                   | Ensure the type given to a custom field is a valid type for custom fields                         |
| standardFieldLabel    | true                   | Disallow changing a label of a standard field                                                     |
| profileMapKeys        | true                   | Ensure proper structure of profiles before deploying                                              |
| multipleDefaults      | true                   | Check for multiple default values in picklists and other places where only one default is allowed |
| picklistPromote       | true                   | Disallow promoting picklist value-set to global since it cannot be done with the API              |
| validateOnlyFlag      | true                   | Disallow deploying data records in a validation only deploy                                       |
