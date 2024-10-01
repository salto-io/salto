# Managing CPQ and Advanced Approvals with Salto

Salesforce CPQ and Advanced Approvals configuration includes both metadata items (e.g. Custom Objects, Apex classes, Triggers, ...) as well as data records of various object types (e.g. Product2, PriceAction**c, PriceCondition**c, ...)
Salto users are able to manage their CPQ and Advanced Approvals metadata as well as relevant data records from a single place - the Salto workspace.

## Configuring Salto for CPQ

By default, Salto's salesforce configuration includes only metadata items that belong to the default package and does not include any data records.
Users that would like to manage their CPQ and Advanced Approvals configuration using Salto needs to:

1. Configure Salto to manage metadata items that belong to the `SBQQ` & `sbaa` salesforce packages
2. Configure Salto to manage relevant CPQ related data records

This can be achieved by editing the `/salto.config/adapters/salesforce.nacl` file within the salto workspace.

### Adding the `SBQQ` and `sbaa` package to the Salto Workspace

Paste the following configuration snippet under the include fetch metadata section in `/salto.config/adapters/salesforce.nacl` (see full example below)

```
{
    metadataType = ".*"
    namespace = "SBQQ"
    name = ".*"
}
{
    metadataType = ".*"
    namespace = "sbaa"
    name = ".*"
}
```

### Adding Relevant Data Records to the Salto workspace

Managing salesforce data records within a Salto workspace is disabled by default and requires adding a `data` configuration section in `/salto.config/adapters/salesforce.nacl`

Salesforce data configuration includes the following information:
* `includeObjects`: A list of object name patterns. Data records of matching salesforce objects will be managed in the salto workspace.
* `excludeObjects`: A list of objects name patterns. Data records of matching salesforce objects will be excluded from the salto workspace.
* `allowReferenceTo`: A list of objects name patterns. Data records of matching salesforce objects will be managed in the salto workspace only in case they are referenced from other managed data records.
* `saltoIDSettings`: Define cross environment id for data records by providing a list of object fields to construct the cross environment id from. Use `##allMasterDetailFields##` in order to include the SaltoID of referenced MasterDetail records.
* `saltoAliasSettings`: Define the fields to create the alias for data records by providing a list of object fields to construct the alias from. Use `##allMasterDetailFields##` in order to include the Alias of referenced MasterDetail records.
* `saltoManagementFieldSettings`: You can instruct Salto to fetch only records where a specific custom boolean field is set to true.
For example, if you only want to fetch certain Product2 records, you can create a custom field called managed_by_salto__c (the actual name doesn’t matter as long as it’s a Boolean) and set this to true for those records you want Salto to fetch.

### Example Salto Salesforce/CPQ Configuration

```
salesforce {
  fetch = {
    metadata = {
      include = [
        {
          metadataType = ".*"
          namespace = ""
          name = ".*"
        },
        {
          metadataType = ".*"
          namespace = "SBQQ"
          name = ".*"
        },
        {
          metadataType = ".*"
          namespace = "sbaa"
          name = ".*"
        },
      ]
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
          metadataType = "Document"
        },
        {
          metadataType = "DocumentFolder"
        },
        {
          metadataType = "Profile"
        },
        {
          metadataType = "PermissionSet"
        },
        {
          metadataType = "SiteDotCom"
        },
        {
          metadataType = "EmailTemplate"
          name = "MarketoEmailTemplates/.*"
        },
        {
          metadataType = "ContentAsset"
        },
        {
          metadataType = "CustomObjectTranslation"
        },
        {
          metadataType = "AnalyticSnapshot"
        },
        {
          metadataType = "WaveDashboard"
        },
        {
          metadataType = "WaveDataflow"
        },
        {
          metadataType = "StandardValueSet"
          name = "^(AddressCountryCode)|(AddressStateCode)$"
          namespace = ""
        },
        {
          metadataType = "Layout"
          name = "CollaborationGroup-Group Layout"
        },
        {
          metadataType = "Layout"
          name = "CaseInteraction-Case Feed Layout"
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
        "SBQQ__.*",
        "sbaa__ApprovalChain__c",
        "sbaa__ApprovalCondition__c",
        "sbaa__ApprovalRule__c",
        "sbaa__ApprovalVariable__c",
        "sbaa__Approver__c",
        "sbaa__EmailTemplate__c",
        "sbaa__TrackedField__c",
      ]
      excludeObjects = [
        "SBQQ__ContractedPrice__c",
        "SBQQ__Quote__c",
        "SBQQ__QuoteDocument__c",
        "SBQQ__QuoteLine__c",
        "SBQQ__QuoteLineGroup__c",
        "SBQQ__Subscription__c",
        "SBQQ__SubscribedAsset__c",
        "SBQQ__SubscribedQuoteLine__c",
        "SBQQ__SubscriptionConsumptionRate__c",
        "SBQQ__SubscriptionConsumptionSchedule__c",
        "SBQQ__WebQuote__c",
        "SBQQ__WebQuoteLine__c",
        "SBQQ__QuoteLineConsumptionSchedule__c",
        "SBQQ__QuoteLineConsumptionRate__c",
        "SBQQ__InstallProcessorLog__c",
        "SBQQ__ProcessInputValue__c",
        "SBQQ__RecordJob__c",
        "SBQQ__TimingLog__c",
      ]
      saltoManagementFieldSettings = {
        defaultFieldName = "ManagedBySalto__c"
      }
      allowReferenceTo = [
        "Product2",
        "Pricebook2",
        "PricebookEntry",
      ]
      saltoIDSettings = {
        defaultIdFields = [
          "Id",
        ]
      }
      brokenOutgoingReferencesSettings = {
        defaultBehavior = "BrokenReference"
        perTargetTypeOverrides = {
          User = "InternalId"
        }
      }
    }
  }
  maxItemsInRetrieveRequest = 2500
}
```
