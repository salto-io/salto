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
  maxConcurrentRetrieveRequests = 3
  maxItemsInRetrieveRequest = 2500
  enableHideTypesInNacls = false
  dataManagement = {
    includeObjects: [
      "SBQQ__CustomAction__c",
      "PricebookEntry",
    ],
    saltoIDSettings: {
      defaultIdFields: ['##allMasterDetailFields##', 'Name'],
      overrides: [
        { objectsRegex: pricebookEntryName, idFields: ['Pricebook2Id', 'Name'] },
        { objectsRegex: SBQQCustomActionName, idFields: ['SBQQ__Location__c', 'SBQQ__DisplayOrder__c', 'Name'] },
      ],
    },
},
}
```

## Configuration options

| Name                                                     | Default when undefined        | Description
| ---------------------------------------------------------| ------------------------------| -----------
| metadataTypesSkippedList                                 | [] (fetch all Metadata Types) | Specified types and their instances will not be fetched
| instancesRegexSkippedList                                | [] (fetch all instances)      | Regular Expressions of instances to exclude their fetch
| maxConcurrentRetrieveRequests                            | 3                             | Limits the max number of concurrent retrieve requests
| maxItemsInRetrieveRequest                                | 2500                          | Limits the max number of requested items a single retrieve request
| enableHideTypesInNacls                                   | false                         | Control whether to generate NaCL files for salesforce types (will be placed under the Types folder)
| [dataManagement](#data-management-configuration-options) | {} (do not manage data)       | Data management configuration 

### Data management configuration options

| Name                                                        | Default when undefined                           | Description
| ------------------------------------------------------------| -------------------------------------------------| -----------
| includeObjects                                              | N/A (required when dataManagement is configured) | Regular Expressions that define which CustomObjects to fetch data for
| excludeObjects                                              | []                                               | Regular Expressions that define which CustomObjects to not fetch their data in case they match includeObjects
| allowReferenceTo                                            | []                                               | Regular Expressions that define CustomObjects to fetch their data records if they are referenced from other data records
| [saltoIDSettings](#salto-id-settings-configuration-options) | N/A (required when dataManagement is configured) | Configuration for cross environments data record ids management 

#### Salto ID settings configuration options

| Name                                                   | Default when undefined                            | Description
| -------------------------------------------------------| --------------------------------------------------| -----------
| defaultIdFields                                        | N/A (required when saltoIDSettings is configured) | Default fields list for defining the data record's cross environment id
| [overrides](#object-id-settings-configuration-options) | []                                                | Overrides the default id fields for specific objects

#### Object ID settings configuration options

| Name         | Default when undefined                      | Description
| -------------| --------------------------------------------| -----------
| objectsRegex | N/A (required when overrides is configured) | Regular Expression that defines which CustomObjects to override their default ID field
| idFields     | []                                          | Fields list for defining the data record's cross environment id
