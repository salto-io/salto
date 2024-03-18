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
      flsProfiles = ["System Administrator", "Cloud Profile"]
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
        {
          metadataType: 'EclairGeoData',
        },
        {
          metadataType:
            'OmniUiCard|OmniDataTransform|OmniIntegrationProcedure|OmniInteractionAccessConfig|OmniInteractionConfig|OmniScript',
        },
        {
          metadataType: 'DiscoveryAIModel',
        },
        {
          metadataType: 'Translations',
        },
      ]
    }
    data = {
      includeObjects = [
        ".*SBQQ__CustomAction__c.*",
        ".*PricebookEntry.*",
      ]
      saltoManagementFieldSettings = {
        defaultFieldName = "ManagedBySalto__c"
      }
      brokenOutgoingReferencesSettings = {
        defaultBehavior = "BrokenReference"
        perTargetTypeOverrides = {
            User = "InternalId"
        }
      }
      omittedFields = [
        "PricebookEntry.Price",
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
| ---------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------- |
| maxItemsInRetrieveRequest                      | 2500                   | Limits the max number of requested items a single retrieve request                |
| [fetch](#fetch-configuration-options)          |                        | Fetch configuration                                                               |
| [client](#client-configuration-options)        | {} (no overrides)      | Configuration relating to the client used to interact with salesforce             |
| [validators](#validator-configuration-options) | {} (all enabled)       | Configuration for choosing which validators will be applied to deploy plans       |
| enumFieldPermissions                           | true                   | Change the FieldPermission values to be enum instead of an Object with references |

## Fetch configuration options

| Name                                           | Default when undefined  | Description                                                                                                                                                                                                           |
| ---------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [metadata](#metadata-configuration-options)    | Fetch all metdata       | Specified the metadata fetch                                                                                                                                                                                          |
| [data](#data-management-configuration-options) | {} (do not manage data) | Data management configuration object names will not be fetched in case they are matched in includeObjects                                                                                                             |
| fetchAllCustomSettings                         | true                    | Whether to fetch all the custom settings instances. When false, it is still possible to choose specific custom settings instances via the `data` option                                                               |
| [optionalFeatures](#optional-features)         | {} (all enabled)        | Granular control over which features are enabled in the adapter, by default all features are enabled in order to get the most information. can be used to turn off features that cause problems until they are solved |
| maxInstancesPerType                            | 5000                    | Do not fetch metadataTypes and CustomObjects with more instances than this number, and add those to the exclude lists                                                                                                 |
| preferActiveFlowVersions                       | false                   | When set to false, flows' latest version will be fetched. Otherwise, flows' active version will be fetched if exists                                                                                                  |
| addNamespacePrefixToFullName                   | true                    | When set to true, namespace prefix will be added to instances in a namespace whose fullName does not begin with the namespace. Otherwise, there will be no change to fullName                                         |
| [warningSettings](#warning-settings)           | {}                      | Enable/disable specific warnings                                                                                                                                                                                      |

### Metadata configuration options

| Name                           | Default when undefined       | Description                                                                                                                                                     |
| ------------------------------ | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [include](#metadata-query)     | Include everything           | Specified the metadata to fetch. Metadata that does not match any of the include criteria will not be fetched                                                   |
| [exclude](#metadata-query)     | [] (Exclude nothing)         | Specified the metadata to not fetch. Metadata that matches any of the exclude criteria will not be fetched even if it also matches some of the include criteria |
| objectsToSeperateFieldsToFiles | [] (Don't split any objects) | Specified a list of objects which will be stored as one field per nacl file                                                                                     |

#### Metadata Query

| Name         | Default when undefined | Description                                                    |
| ------------ | ---------------------- | -------------------------------------------------------------- |
| namespace    | ".\*" (All namespaces) | A regular expression of a namespace to query with              |
| metadataType | ".\*" (All types)      | A regular expression of a metadata type to query with          |
| name         | ".\*" (All names)      | A regular expression of a metadata instance name to query with |

### Optional Features

| Name                              | Default when undefined | Description                                                                                                                                                           |
| --------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| extraDependencies                 | true                   | Find additional dependencies between configuration elements by using the salesforce tooling API                                                                       |
| elementsUrls                      | true                   | Populate URLs for your salesforce configuration elements and enable quick navigation from Salto to the corresponding salesforce screen                                |
| addMissingIds                     | true                   | Populate Salesforce internal ids for a few types that require special handling                                                                                        |
| profilePaths                      | true                   | Update file names for profiles whose API name is different from their display name                                                                                    |
| authorInformation                 | true                   | Populate Salesforce author information about who and when last changed Salesforce configuration elements.                                                             |
| describeSObjects                  | true                   | Fetch additional information about CustomObjects from the soap API                                                                                                    |
| formulaDeps                       | true                   | Parse formula fields in custom objects for additional dependencies beyond those provided by the tooling API                                                           |
| fetchCustomObjectUsingRetrieveApi | true                   | Use the Salesforce Metadata Retrieve API to fetch CustomObjects. This should improve reliability and data accuracy, but may have a small performance impact           |
| fetchProfilesUsingReadApi         | false                  | Use the Salesforce Metadata Read API to fetch Profile instances. This will reduce the accuracy of the data and may result in crashes, but may be needed for debugging |
| generateRefsInProfiles            | false                  | Generate references from profiles. This will have a significant performance impact, but will provide references from profiles to fields and elements.                 |
| skipAliases                       | false                  | Do not create aliases for Metadata Elements                                                                                                                           |

### Warning settings

| Name               | Default when undefined | Description                                                       |
| ------------------ | ---------------------- | ----------------------------------------------------------------- |
| nonQueryableFields | true                   | Warn when fetching records of an object with non-queryable fields |

### Data management configuration options

| Name                                                                          | Default when undefined                           | Description                                                                                               |
| ----------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| includeObjects                                                                | N/A (required when dataManagement is configured) | Data records of matched object names will be fetched                                                      |
| excludeObjects                                                                | []                                               | Data records of matched object names will not be fetched in case they are matched in includeObjects       |
| allowReferenceTo                                                              | []                                               | Data records of matched object names will be fetched only when referenced from other fetched data records |
| [saltoIDSettings](#salto-id-settings-configuration-options)                   | N/A (required when dataManagement is configured) | Configuration for cross environments data record ids management                                           |
| [saltoAliasSettings](#salto-alias-settings-configuration-options)             | N/A                                              | Configuration for data record aliases                                                                     |
| [saltoManagementFieldSettings](#salto-management-field-configuration-options) | {}                                               | Configuration for managed-by-Salto field                                                                  |
| [brokenOutgoingReferencesSettings](#broken-outgoing-references-settings)      | {}                                               | Configuration for handling broken references                                                              |
| omittedFields                                                                 | []                                               | List of API names of fields to discard when fetching data records.                                        |

#### Salto ID settings configuration options

| Name                                                   | Default when undefined                            | Description                                                             |
| ------------------------------------------------------ | ------------------------------------------------- | ----------------------------------------------------------------------- |
| defaultIdFields                                        | N/A (required when saltoIDSettings is configured) | Default fields list for defining the data record's cross environment id |
| [overrides](#object-id-settings-configuration-options) | []                                                | Overrides the default id fields for specific objects                    |

#### Salto Alias settings configuration options

| Name                                                      | Default when undefined | Description                                              |
| --------------------------------------------------------- | ---------------------- | -------------------------------------------------------- |
| defaultAliasFields                                        | N/A                    | Default fields list for defining the data record's alias |
| [overrides](#object-alias-settings-configuration-options) | []                     | Overrides the default alias fields for specific objects  |

#### Salto management field configuration options

| Name             | Default when undefined | Description                                                                                        |
| ---------------- | ---------------------- | -------------------------------------------------------------------------------------------------- |
| defaultFieldName | N/A                    | If this entry is set, Salto will not fetch records where this field exists and is equal to `false` |

#### Broken outgoing references settings

| Name                   | Default when undefined | Description                                                                                                     |
| ---------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| defaultBehavior        | "BrokenReference"      | Action to take when a record has a lookup field that refers to a record that was not fetched                    |
| perTargetTypeOverrides | { User: "InternalId" } | A map where the key is a type name and the value is the broken reference behavior for the reference target type |

##### Broken reference behaviors

| Name              | Behavior                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| "ExcludeInstance" | Do not fetch instances that contain a reference whose target was not fetched                      |
| "BrokenReference" | Fetch the instance and create Salto references to non-existant targets.                           |
| "InternalId"      | Fetch the instance and keep the existing field value (the internal ID of the referenced instance) |

#### Object ID settings configuration options

| Name         | Default when undefined                      | Description                                                                                   |
| ------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| objectsRegex | N/A (required when overrides is configured) | Cross environments ids of the matched object names will be defined by the specified id fields |
| idFields     | []                                          | Fields list for defining the data record's cross environment id                               |

#### Object Alias settings configuration options

| Name         | Default when undefined                      | Description                                                                  |
| ------------ | ------------------------------------------- | ---------------------------------------------------------------------------- |
| objectsRegex | N/A (required when overrides is configured) | Alias of the matched object names will be defined by the specified id fields |
| aliasFields  | []                                          | Fields list for defining the data record's alias                             |

### Client configuration options

| Name                                                          | Default when undefined                                | Description                                                                                        |
| ------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [polling](#client-polling-options)                            | `{}` (no overrides)                                   | Configuration for polling asynchronous operations (deploy, retrieve, bulk data operations)         |
| [deploy](#client-deploy-options)                              | `{}` (no overrides)                                   | Deploy options                                                                                     |
| [retry](#client-retry-options)                                | `{}` (no overrides)                                   | Configuration for retrying on errors                                                               |
| [maxConcurrentApiRequests](#rate-limit-configuration-options) | `{}` (no overrides)                                   | Limits on the number of concurrent requests of different types                                     |
| [dataRetry](#client-data-retry-options)                       | `{}` (no overrides)                                   | Configuration for retrying on specific errors regarding data objects (for custom object instances) |
| [readMetadataChunkSize](#read-metadata-chunk-size)            | 10 except for Profile and PermissionSet (which are 1) | Configuration for specifing the size of the chunk in readMetadata                                  |

#### Client polling options

| Name          | Default when undefined | Description                                                                           |
| ------------- | ---------------------- | ------------------------------------------------------------------------------------- |
| interval      | `3000` (3 seconds)     | The interval (milliseconds) at which the client checks wether the operation completed |
| deployTimeout | `5400000` (1.5 hours)  | The timeout (milliseconds) on deploy operations                                       |
| fetchTimeout  | `1800000` (30 minutes) | The timeout (milliseconds) on fetch operations                                        |

#### Client deploy options

| Name               | Default when undefined                                 | Description                                                                                                                                                                                                              |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| rollbackOnError    | `true`                                                 | Indicates whether any failure causes a complete rollback or not. Must be set to `true` if deploying to a production org.                                                                                                 |
| ignoreWarnings     | `true`                                                 | Indicates whether deployments with warnings complete successfully or not.                                                                                                                                                |
| purgeOnDelete      | `false`                                                | If `true`, deleted components aren't stored in the Recycle Bin. Instead, they become immediately eligible for deletion. This option only works in Developer Edition or sandbox orgs. It doesn’t work in production orgs. |
| checkOnly          | `false`                                                | If `true`, deploy will run a "validation deploy", changes will not be immediately applied to the service                                                                                                                 |
| testLevel          | `NoTestRun` (development) `RunLocalTests` (production) | Specifies which tests are run as part of a deployment. possible values are: `NoTestRun`, `RunSpecifiedTests`, `RunLocalTests` and `RunAllTestsInOrg`                                                                     |
| runTests           | `[]` (no tests)                                        | A list of Apex tests to run during deployment, must configure `RunSpecifiedTests` in `testLevel` for this option to work                                                                                                 |
| deleteBeforeUpdate | `false`                                                | If `true`, deploy will make deletions before any other deployed change                                                                                                                                                   |
| flsProfiles        | `["System Administraor"]`                              | When deploying new CustomFields and CustomObjects, Salto will make them visible to the specified Profiles                                                                                                                |

For more details see the DeployOptions section in the [salesforce documentation of the deploy API](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_deploy.htm)

#### Client retry options

| Name          | Default when undefined | Description                                                                                                                                                  |
| ------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| maxAttempts   | `5`                    | The number of attempts to make for each request                                                                                                              |
| retryDelay    | `5000` (5 seconds)     | The time (milliseconds) to wait between attempts                                                                                                             |
| retryStrategy | `NetworkError`         | In which cases to retry. Supported choices: `NetworkError` (retry on network errors), `HttpError` (retry on HTTP 5xx errors), or `HTTPOrNetworkError` (both) |
| timeout       | `900000` (15 minutes)  | The timeout (milliseconds) on each request retry                                                                                                             |

### Rate limit configuration options

| Name     | Default when undefined | Description                                                                                                          |
| -------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| retrieve | `3`                    | Max number of concurrent retrieve requests (retrieve)                                                                |
| read     | `-1` (unlimited)       | Max number of concurrent read requests (readMetadata)                                                                |
| list     | `-1` (unlimited)       | Max number of concurrent list requests (listMetadataObjects)                                                         |
| query    | `4`                    | Max number of concurrent SOQL query requests (query, queryMore)                                                      |
| describe | `-1` (unlimited)       | Max number of concurrent describe requests (listMetadataTypes, describeMetadataType, listSObjects, describeSObjects) |
| deploy   | `-1` (unlimited)       | Max number of concurrent deploy requests (deploy, bulkLoadOperation)                                                 |
| total    | `100` (unlimited)      | Global limit of concurrent api requests                                                                              |

### Client data retry options

| Name                 | Default when undefined                                  | Description                                                                                                                                                       |
| -------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| maxAttempts          | `5`                                                     | Max attempts to deploy data instances                                                                                                                             |
| retryDelay           | `1000`                                                  | Delay (in ms) before the first retry                                                                                                                              |
| retryDelayMultiplier | `1.5`                                                   | The amount by which the delay is increased between consecutive retries - i.e the first retry is 1000ms, the second is 1.5*1000ms, the third is 1.5*1.5\*1000ms... |
| retryableFailures    | `FIELD_CUSTOM_VALIDATION_EXCEPTION, UNABLE_TO_LOCK_ROW` | Error messages for which to retry                                                                                                                                 |

|

### Read metadata chunk size

| Name      | Default when undefined                 | Description                                  |
| --------- | -------------------------------------- | -------------------------------------------- |
| default   | `10`                                   | Default value for chunk size in readMetadata |
| overrides | Profile and PermissionSet are set to 1 | Chunk size for specific metadata types       |

## Validator Configuration Options

| Name                         | Default when undefined | Description                                                                                       |
| ---------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------- |
| managedPackage               | true                   | Disallow changes to objects and fields that are part of a managed package                         |
| picklistStandardField        | true                   | It is forbidden to modify a picklist on a standard field. Only StandardValueSet is allowed        |
| customObjectInstances        | true                   | Validate permissions of creating / update data records                                            |
| unknownField                 | true                   | Disallow deploying an unknown field type                                                          |
| customFieldType              | true                   | Ensure the type given to a custom field is a valid type for custom fields                         |
| standardFieldLabel           | true                   | Disallow changing a label of a standard field                                                     |
| mapKeys                      | true                   | Ensure proper structure of profiles before deploying                                              |
| multipleDefaults             | true                   | Check for multiple default values in picklists and other places where only one default is allowed |
| picklistPromote              | true                   | Disallow promoting picklist value-set to global since it cannot be done with the API              |
| dataCategoryGroup            | true                   | Warn when deploying additions or changes to DataCategoryGroup elements                            |
| installedPackages            | true                   | Disallow any changes on metadata instances of type InstalledPackage.                              |
| recordTypeDeletion           | true                   | Disallow deletion of recordType.                                                                  |
| flowsValidator               | true                   | Better flows versions management, mostly regarding the work with active flows.                    |
| cpqValidator                 | true                   | Disallow any CPQ changes before disabling CPQ trigger on SF org.                                  |
| fullNameChangedValidator     | true                   | Disallow any fullName property changes.                                                           |
| invalidListViewFilterScope   | true                   | Disallow usage of some scopes as the 'filterScope' property of a ListView element.                |
| caseAssignmentRulesValidator | true                   | Disallow deployment of case assignment rules with case teams.                                     |
| unknownUser                  | true                   | Disallow any changes with reference to non existing users in the target org.                      |
| animationRuleRecordType      | true                   | Disallow deployment of AnimationRule with invalid RecordType.                                     |
| currencyIsoCodes             | true                   | Disallow any changes that includes unsupported org currency.                                      |
| duplicateRulesSortOrder      | true                   | Disallow deployment of duplicate rule instances that are not in sequential order.                 |
| lastLayoutRemoval            | true                   | Disallow deletion of the last layout for custom objects.                                          |
| accountSettings              | true                   | Cannot set a value for enableAccountOwnerReport without proper org setting.                       |
| unknownPicklistValues        | true                   | Disallow any usage of unknown pickList values.                                                    |
