# Managing CPQ and Advanced Approvals with Salto
Salesforce CPQ and Advanced Approvals configuration includes both metadata items (e.g. Custom Objects, Apex classes, Triggers, ...) as well as data records of various object types (e.g. Product2, PriceAction__c, PriceCondition__c, ...)
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
Managing salesforce data records within a Salto workspace is disabled by default and its reuqired to add a `data` configuration section in `/salto.config/adapters/salesforce.nacl`

Salesforce data configuration includes the following information:
* `includeObjects`: A list of object name patterns. Data records of matching salesforce objects will be managed in the salto workspace.
* `excludeObjects`: A list of objects name patterns. Data records of matching salesforce objects will be excluded from the salto workspace.
* `allowReferenceTo`: A list of objects name patterns. Data records of matching salesforce objects will be managed in the salto workspace only in case they are referenced from other managed data records.
* `saltoIDSettings`: Define cross environment id for data records by providing a list of object fields to construct the cross environment id from. Use `##allMasterDetailFields##` in order to include the SaltoID of referenced MasterDetail records.

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
          "SBQQ__QuoteLineConsumptionsRate__c",
          "SBQQ__InstallProcessorLog__c",
          "SBQQ__ProcessInputValue__c",
          "SBQQ__RecordJob__c",
          "SBQQ__TimingLog__c",
        ]
        allowReferenceTo = [
          "Product2",
          "Pricebook2",
          "PricebookEntry",
        ]
        saltoIDSettings = {
          defaultIdFields = [
            "##allMasterDetailFields##",
            "Name",
          ]
          overrides = [
            {
                objectsRegex = "SBQQ__CustomAction__c"
                idFields = [
                  "SBQQ__Location__c",
                  "SBQQ__DisplayOrder__c",
                  "SBQQ__Type__c",
                  "Name",
                ]
            },
            {
                objectsRegex = "SBQQ__ProductFeature__c"
                idFields = [
                  "##allMasterDetailFields##",
                  "SBQQ__ConfiguredSKU__c",
                  "SBQQ__Category__c",
                  "SBQQ__Number__c",
                  "Name",
                ]
            },
            {
                objectsRegex = "SBQQ__ConfigurationAttribute__c"
                idFields = [
                  "##allMasterDetailFields##",
                  "SBQQ__Product__c",
                  "SBQQ__Feature__c",
                  "SBQQ__TargetField__c",
                  "Name",
                ]
            },
            {
              objectsRegex = "SBQQ__FavoriteProduct__c"
              idFields = [
                "##allMasterDetailFields##",
                "SBQQ__DynamicOptionId__c",
                "Name",
              ]
            },
            {
              objectsRegex = "SBQQ__LineColumn__c"
              idFields = [
                "##allMasterDetailFields##",
                "SBQQ__FieldName__c",
                "Name",
              ]
            },
            {
              objectsRegex = "SBQQ__LookupQuery__c"
              idFields = [
                "##allMasterDetailFields##",
                "SBQQ__PriceRule2__c",
                "Name",
              ]
            },
            {
              objectsRegex = "SBQQ__TemplateContent__c"
              idFields = [
                "##allMasterDetailFields##",
                "SBQQ__Type__c",
                "Name",
              ]
            },
            {
              objectsRegex = "SBQQ__Dimension__c"
              idFields = [
                "##allMasterDetailFields##",
                "SBQQ__Product__c",
                "Name",
              ]
            },
            {
              objectsRegex = "PricebookEntry"
              idFields = [
                "Pricebook2Id",
                "Name",
              ]
            },
            {
              objectsRegex = "Product2"
              idFields = [
                "Name",
                "ProductCode",
                "Family",
              ]
            },
            {
              objectsRegex = "sbaa__ApprovalRule__c"
              idFields = [
                "Name",
                "sbaa__TargetObject__c",
                "sbaa__ApprovalChain__c",
                "sbaa__Approver__c",
                "sbaa__ApproverField__c",
              ]
            },
            {
              objectsRegex = "sbaa__Approver__c"
              idFields = [
                "Name",
              ]
            },
            {
              objectsRegex = "sbaa__EmailTemplate__c"
              idFields = [
                "Name",
                "sbaa__TemplateId__c",
              ]
            },
            {
              objectsRegex = "sbaa__ApprovalCondition__c"
              idFields = [
                "sbaa__ApprovalRule__c",
                "sbaa__Index__c",
              ]
            },
            {
              objectsRegex = "sbaa__ApprovalChain__c"
              idFields = [
                "sbaa__TargetObject__c",
                "Name",
              ]
            },
            {
              objectsRegex = "sbaa__ApprovalVariable__c"
              idFields = [
                "sbaa__TargetObject__c",
                "Name",
              ]
            },
            {
              objectsRegex = "sbaa__TrackedField__c"
              idFields = [
                "sbaa__ApprovalRule__c",
                "sbaa__RecordField__c",
                "sbaa__TrackedField__c",
                "sbaa__TrackedObject__c",
                "sbaa__TrackingType__c",
              ]
            },
          ]
        }
    }
  }
  maxItemsInRetrieveRequest = 2500
}
```
