# Zuora Billing configuration
## Configuration example
```hcl
zuora_billing {
  client = {
    retry = {
      maxAttempts = 5
      retryDelay = 5000
    }
    rateLimit = {
      total = -1
      get = 15
    }
  }
  fetch = {
    includeTypes = [
      "AccountingCodes",
      "AccountingPeriods",
      "CatalogProduct",
      "CustomObject",
      "EventTriggers",
      "HostedPages",
      "NotificationDefinitions",
      "NotificationEmailTemplates",
      "PaymentGateways",
      "SequenceSets",
      "StandardObject",
      "WorkflowExport",
    ]
    settingsIncludeTypes = [
      "AccountingRules",
      "AgingBucket",
      "AllCustomObjectNamespaces",
      "AllNotifications",
      "AllPaymentTerms",
      "AllRevenueRecognition",
      "AllTaxCode",
      "AllWorkflows",
      "ApplicationRules",
      "AttachmentLimitResponse",
      "AuditTrail",
      "BatchAlias",
      "BillingCycleType",
      "BillingListPriceBase",
      "BillingPeriod",
      "BillingPeriodStart",
      "BillingRules",
      "ChargeModel",
      "ChargeType",
      "CommunicationProfiles",
      "Currencies",
      "CustomFields",
      "DataAccess",
      "DiscountSettings",
      "DocPrefix",
      "EntityConnections",
      "EntityNodes",
      "ExternalSmtp",
      "FxCurrency",
      "GatewayResponse",
      "GetTaxCompanies",
      "GlSegments",
      "HierarchyDefinition",
      "HierarchyInfo",
      "HostedPaymentPages",
      "InsightsConnection",
      "Notification",
      "NumberAndSku",
      "PaymentGateways",
      "PaymentMethods",
      "PaymentRetryRules",
      "PaymentRules",
      "ProductAttribute",
      "ReasonCodes",
      "RevenueEventTypes",
      "RevenueRecognitionModels",
      "revenueRecognitionRuleDtos",
      "RevenueRecognitionStatus",
      "RevenueStartDate",
      "RolesPage",
      "SecurityPolicy",
      "SegmentationRules",
      "SharingAttribute",
      "SubscriptionSetting",
      "TaxCompany",
      "TaxRatePeriod",
      "TaxRates",
      "Template",
      "TenantProfileChangeHistories",
      "TenantProfileResponse",
      "UnitOfMeasure",
      "UnitsOfMeasureList",
      "WorkflowObject",
      "ZuoraTaxCode",
      "ZuoraTaxEngine",
    ]
  }
}
```

## Configuration options

| Name                                                     | Default when undefined        | Description
| ---------------------------------------------------------| ------------------------------| -----------
| [client](#client-configuration-options)                  | `{}` (no overrides)             | Configuration relating to the client used to interact with Zuora
| [fetch](#fetch-configuration-options)                    | `{}` (no overrides)             | Configuration relating to the endpoints that will be queried during fetch

### Client configuration options

| Name                                                          | Default when undefined   | Description
|---------------------------------------------------------------|--------------------------|------------
| [retry](#retry-configuration-options)                         | `{}` (no overrides)      | Configuration for retrying on errors
| [rateLimit](#rate-limit-configuration-options)                | `{}` (no overrides)      | Limits on the number of concurrent requests of different types

#### Client retry options

| Name           | Default when undefined | Description
|----------------|------------------------|------------
| maxAttempts    | `5`                    | The number of attempts to make for each request
| retryDelay     | `5000` (5 seconds)     | The time (milliseconds) to wait between attempts

### Rate limit configuration options

| Name                                                        | Default when undefined                           | Description
| ------------------------------------------------------------| -------------------------------------------------| -----------
| get                                                         | `15`                                             | Max number of concurrent get requests
| total                                                       | `-1` (unlimited)                                 | Shared limit for all concurrent requests

## Fetch configuration options

| Name                                        | Default when undefined          | Description
|---------------------------------------------|---------------------------------|------------
| includeTypes                                | [                               | List of types to fetch, excluding settings types which are listed separately under settingsIncludeTypes
|                                             |   "CatalogProduct",             |
|                                             |   "CustomObject",               |
|                                             |   "StandardObject",             |
|                                             |   "AccountingCodes",            |
|                                             |   "AccountingPeriods",          |
|                                             |   "HostedPages",                |
|                                             |   "NotificationDefinitions",    |
|                                             |   "NotificationEmailTemplates", |
|                                             |   "PaymentGateways",            |
|                                             |   "SequenceSets",               |
|                                             |   "WorkflowExport",             |
|                                             |  ]                              |
| settingsIncludeTypes                        | [                               | List of settings types to fetch
|                                             |   "AccountingRules",
|                                             |   "AgingBucket",
|                                             |   "AllCustomObjectNamespaces",
|                                             |   "AllNotifications",
|                                             |   "AllPaymentTerms",
|                                             |   "AllRevenueRecognition",
|                                             |   "AllTaxCode",
|                                             |   "AllWorkflows",
|                                             |   "ApplicationRules",
|                                             |   "AttachmentLimitResponse",
|                                             |   "AuditTrail",
|                                             |   "BatchAlias",
|                                             |   "BillingCycleType",
|                                             |   "BillingListPriceBase",
|                                             |   "BillingPeriod",
|                                             |   "BillingPeriodStart",
|                                             |   "BillingRules",
|                                             |   "ChargeModel",
|                                             |   "ChargeType",
|                                             |   "CommunicationProfiles",
|                                             |   "Currencies",
|                                             |   "CustomFields",
|                                             |   "DataAccess",
|                                             |   "DiscountSettings",
|                                             |   "DocPrefix",
|                                             |   "EntityConnections",
|                                             |   "EntityNodes",
|                                             |   "ExternalSmtp",
|                                             |   "FxCurrency",
|                                             |   "GatewayResponse",
|                                             |   "GetTaxCompanies",
|                                             |   "GlSegments",
|                                             |   "HierarchyDefinition",
|                                             |   "HierarchyInfo",
|                                             |   "HostedPaymentPages",
|                                             |   "InsightsConnection",
|                                             |   "Notification",
|                                             |   "NumberAndSku",
|                                             |   "PaymentGateways",
|                                             |   "PaymentMethods",
|                                             |   "PaymentRetryRules",
|                                             |   "PaymentRules",
|                                             |   "ProductAttribute",
|                                             |   "ReasonCodes",
|                                             |   "RevenueEventTypes",
|                                             |   "RevenueRecognitionModels",
|                                             |   "revenueRecognitionRuleDtos",
|                                             |   "RevenueRecognitionStatus",
|                                             |   "RevenueStartDate",
|                                             |   "RolesPage",
|                                             |   "SecurityPolicy",
|                                             |   "SegmentationRules",
|                                             |   "SharingAttribute",
|                                             |   "SubscriptionSetting",
|                                             |   "TaxCompany",
|                                             |   "TaxRatePeriod",
|                                             |   "TaxRates",
|                                             |   "Template",
|                                             |   "TenantProfileChangeHistories",
|                                             |   "TenantProfileResponse",
|                                             |   "UnitOfMeasure",
|                                             |   "UnitsOfMeasureList",
|                                             |   "WorkflowObject",
|                                             |   "ZuoraTaxCode",
|                                             |   "ZuoraTaxEngine",
|                                             |  ]                              |
