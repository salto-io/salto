# Example CPQ Configuration

For default CPQ support paste the following configuration to `/salto.config/adapters/salesforce.nacl`

```
data = {
  includeObjects = [
    "SBQQ__.*",
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
    "SBQQ__QuoteLineCosumptionSchedule__c",
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
          "Name",
          "SBQQ__Location__c",
          "SBQQ__DisplayOrder__c",
        ]
      },
      {
        objectsRegex = "SBQQ__ProductFeature__c"
        idFields = [
          "##allMasterDetailFields##",
          "SBQQ__ConfiguredSKU__c",
          "Name",
        ]
      },
      {
        objectsRegex = "SBQQ__ConfigurationAttribute__c"
        idFields = [
          "##allMasterDetailFields##",
          "SBQQ__TargetField__c",
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
        objectsRegex = "PricebookEntry"
        idFields = [
          "Name",
          "Pricebook2Id",
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
    ]
  }
}
```
