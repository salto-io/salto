# Zuora Billing system configuration

## Default Configuration

```hcl
zuora_billing {
  apiDefinitions = {
    swagger = {
      url = "https://raw.githubusercontent.com/salto-io/adapter-swaggers/main/zuora_billing/swagger.yaml"
      typeNameOverrides = [
        {
          originalName = "events__event_triggers@uub"
          newName = "EventTriggers"
        },
        {
          originalName = "notifications__email_templates@uub"
          newName = "NotificationEmailTemplates"
        },
        {
          originalName = "notifications__notification_definitions@uub"
          newName = "NotificationDefinitions"
        },
        {
          originalName = "ExportWorkflowVersionResponse"
          newName = "WorkflowExport"
        },
        {
          originalName = "GETAccountingCodeItemWithoutSuccessType"
          newName = "AccountingCodeItem"
        },
        {
          originalName = "GETAccountingCodesType"
          newName = "AccountingCodes"
        },
        {
          originalName = "GETAccountingPeriodsType"
          newName = "AccountingPeriods"
        },
        {
          originalName = "GETAccountingPeriodWithoutSuccessType"
          newName = "AccountingPeriod"
        },
        {
          originalName = "GETAllCustomObjectDefinitionsInNamespaceResponse"
          newName = "CustomObject"
        },
        {
          originalName = "GETCatalogType"
          newName = "CatalogProduct"
        },
        {
          originalName = "GetHostedPagesType"
          newName = "HostedPages"
        },
        {
          originalName = "GetHostedPageType"
          newName = "HostedPage"
        },
        {
          originalName = "GETPaymentGatwaysResponse"
          newName = "PaymentGateways"
        },
        {
          originalName = "GETAPaymentGatwayResponse"
          newName = "PaymentGatewayResponse"
        },
        {
          originalName = "GETPublicEmailTemplateResponse"
          newName = "PublicEmailTemplate"
        },
        {
          originalName = "GETPublicNotificationDefinitionResponse"
          newName = "PublicNotificationDefinition"
        },
        {
          originalName = "GETSequenceSetResponse"
          newName = "SequenceSet"
        },
        {
          originalName = "GETSequenceSetsResponse"
          newName = "SequenceSets"
        },
        {
          originalName = "GetWorkflowsResponse"
          newName = "Workflows"
        },
        {
          originalName = "ListAllSettingsResponse"
          newName = "ListAllSettings"
        },
        {
          originalName = "GETProductType"
          newName = "ProductType"
        },
        {
          originalName = "GETProductRatePlanType"
          newName = "ProductRatePlanType"
        },
      ]
      additionalTypes = [
        {
          typeName = "StandardObject"
          cloneFrom = "CustomObject"
        },
      ]
    }
    settingsSwagger = {
      typeNameOverrides = [
        {
          originalName = "settings__tax_engines@uub"
          newName = "Settings_TaxEngines"
        },
        {
          originalName = "Settings_RevenueRecognitionRuleObject"
          newName = "Settings_revenueRecognitionRuleDtos"
        },
      ]
    }
    typeDefaults = {
      transformation = {
        idFields = [
          "name",
        ]
        fieldsToOmit = [
          {
            fieldName = "createdBy"
            fieldType = "string"
          },
          {
            fieldName = "createdOn"
            fieldType = "string"
          },
          {
            fieldName = "updatedBy"
            fieldType = "string"
          },
          {
            fieldName = "updatedOn"
            fieldType = "string"
          },
          {
            fieldName = "updatedById"
            fieldType = "string"
          },
          {
            fieldName = "CreatedDate"
            fieldType = "string"
          },
          {
            fieldName = "UpdatedDate"
            fieldType = "string"
          },
          {
            fieldName = "CreatedById"
            fieldType = "string"
          },
          {
            fieldName = "UpdatedById"
            fieldType = "string"
          },
          {
            fieldName = "nextPage"
            fieldType = "string"
          },
          {
            fieldName = "next"
            fieldType = "string"
          },
          {
            fieldName = "pagination"
          },
        ]
      }
    }
    types = {
      WorkflowExport = {
        request = {
          url = "/workflows/{workflow_id}/export"
          dependsOn = [
            {
              pathParam = "workflow_id"
              from = {
                type = "Workflows"
                field = "id"
              }
            },
          ]
        }
        transformation = {
          idFields = [
            "workflow.name",
            "workflow.id",
          ]
          standaloneFields = [
            {
              fieldName = "workflow"
            },
            {
              fieldName = "tasks"
            },
          ]
        }
      }
      Linkage = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "internal_group"
              fieldType = "string"
            },
          ]
        }
      }
      Workflows = {
        request = {
          url = "/workflows"
          paginationField = "pagination.next_page"
        }
      }
      Workflow = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "status"
              fieldType = "string"
            },
          ]
        }
      }
      PublicEmailTemplate = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "eventCategory"
              fieldType = "number"
            },
            {
              fieldName = "useAdditionalAddresses"
              fieldType = "boolean"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "id"
              fieldType = "string"
            },
          ]
        }
      }
      EventTriggers = {
        request = {
          url = "/events/event-triggers"
          paginationField = "next"
        }
      }
      EventTrigger = {
        transformation = {
          idFields = [
            "baseObject",
            "eventType.name",
          ]
        }
      }
      EventType = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "namespace"
              fieldType = "string"
            },
          ]
        }
      }
      NotificationDefinitions = {
        request = {
          url = "/notifications/notification-definitions"
          paginationField = "next"
        }
      }
      NotificationEmailTemplates = {
        request = {
          url = "/notifications/email-templates"
          paginationField = "next"
        }
      }
      Task = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "delay"
              fieldType = "number"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "id"
              fieldType = "number"
            },
          ]
        }
      }
      CustomObject = {
        transformation = {
          dataField = "definitions"
        }
      }
      CustomObjectDefinition = {
        transformation = {
          idFields = [
            "type",
          ]
        }
      }
      StandardObject = {
        request = {
          url = "/objects/definitions/com_zuora"
        }
        transformation = {
          dataField = "definitions"
        }
      }
      HostedPages = {
        transformation = {
          dataField = "hostedpages"
        }
      }
      HostedPage = {
        transformation = {
          idFields = [
            "pageType",
            "pageName",
          ]
          fieldTypeOverrides = [
            {
              fieldName = "pageVersion"
              fieldType = "number"
            },
          ]
        }
      }
      ListAllSettings = {
        transformation = {
          dataField = "."
        }
      }
      SettingItemWithOperationsInformation = {
        transformation = {
          idFields = [
            "key",
          ]
        }
      }
      CatalogProduct = {
        request = {
          url = "/v1/catalog/products"
          paginationField = "nextPage"
        }
        transformation = {
          dataField = "products"
        }
      }
      AccountingCodeItem = {
        transformation = {
          idFields = [
            "type",
            "name",
          ]
          fieldsToHide = [
            {
              fieldName = "id"
              fieldType = "string"
            },
          ]
        }
      }
      ProductType = {
        transformation = {
          idFields = [
            "sku",
          ]
          fileNameFields = [
            "name",
          ]
          fieldTypeOverrides = [
            {
              fieldName = "productRatePlans"
              fieldType = "list<ProductRatePlanType>"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "id"
              fieldType = "string"
            },
          ]
          standaloneFields = [
            {
              fieldName = "productRatePlans"
            },
          ]
        }
      }
      ProductRatePlanType = {
        transformation = {
          fieldsToHide = [
            {
              fieldName = "id"
              fieldType = "string"
            },
          ]
        }
      }
      AccountingPeriod = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "fiscalYear"
              fieldType = "number"
            },
            {
              fieldName = "fiscalQuarter"
              fieldType = "number"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "id"
              fieldType = "string"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "createdBy"
              fieldType = "string"
            },
            {
              fieldName = "createdOn"
              fieldType = "string"
            },
            {
              fieldName = "updatedBy"
              fieldType = "string"
            },
            {
              fieldName = "updatedOn"
              fieldType = "string"
            },
            {
              fieldName = "updatedById"
              fieldType = "string"
            },
            {
              fieldName = "CreatedDate"
              fieldType = "string"
            },
            {
              fieldName = "UpdatedDate"
              fieldType = "string"
            },
            {
              fieldName = "CreatedById"
              fieldType = "string"
            },
            {
              fieldName = "UpdatedById"
              fieldType = "string"
            },
            {
              fieldName = "nextPage"
              fieldType = "string"
            },
            {
              fieldName = "next"
              fieldType = "string"
            },
            {
              fieldName = "pagination"
            },
            {
              fieldName = "runTrialBalanceEnd"
              fieldType = "string"
            },
            {
              fieldName = "runTrialBalanceStart"
              fieldType = "string"
            },
            {
              fieldName = "runTrialBalanceStatus"
              fieldType = "string"
            },
          ]
        }
      }
      GETAccountingPeriodType = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "fiscalYear"
              fieldType = "number"
            },
          ]
        }
      }
      GETProductRatePlanChargePricingType = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "price"
              fieldType = "number"
            },
            {
              fieldName = "discountAmount"
              fieldType = "number"
            },
            {
              fieldName = "discountPercentage"
              fieldType = "number"
            },
            {
              fieldName = "includedUnits"
              fieldType = "number"
            },
            {
              fieldName = "overagePrice"
              fieldType = "number"
            },
          ]
        }
      }
      GETProductRatePlanChargePricingTierType = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "price"
              fieldType = "number"
            },
            {
              fieldName = "startingUnit"
              fieldType = "number"
            },
            {
              fieldName = "endingUnit"
              fieldType = "number"
            },
          ]
        }
      }
      GETProductRatePlanChargeType = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "defaultQuantity"
              fieldType = "number"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "createdBy"
              fieldType = "string"
            },
            {
              fieldName = "createdOn"
              fieldType = "string"
            },
            {
              fieldName = "updatedBy"
              fieldType = "string"
            },
            {
              fieldName = "updatedOn"
              fieldType = "string"
            },
            {
              fieldName = "updatedById"
              fieldType = "string"
            },
            {
              fieldName = "CreatedDate"
              fieldType = "string"
            },
            {
              fieldName = "UpdatedDate"
              fieldType = "string"
            },
            {
              fieldName = "CreatedById"
              fieldType = "string"
            },
            {
              fieldName = "UpdatedById"
              fieldType = "string"
            },
            {
              fieldName = "nextPage"
              fieldType = "string"
            },
            {
              fieldName = "next"
              fieldType = "string"
            },
            {
              fieldName = "pagination"
            },
            {
              fieldName = "id"
              fieldType = "string"
            },
          ]
        }
      }
      PublicNotificationDefinition_filterRule = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "createdBy"
              fieldType = "string"
            },
            {
              fieldName = "createdOn"
              fieldType = "string"
            },
            {
              fieldName = "scheduled"
              fieldType = "boolean"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "id"
              fieldType = "string"
            },
            {
              fieldName = "createdBy"
            },
            {
              fieldName = "createdOn"
            },
            {
              fieldName = "scheduled"
            },
          ]
        }
      }
      SequenceSet = {
        transformation = {
          fieldsToHide = [
            {
              fieldName = "id"
              fieldType = "string"
            },
          ]
        }
      }
      Settings_GatewayResponse = {
        request = {
          url = "/settings/payment-gateways/{id}"
          dependsOn = [
            {
              pathParam = "id"
              from = {
                type = "Settings_PaymentGateways"
                field = "id"
              }
            },
          ]
        }
        transformation = {
          idFields = [
            "gatewayName",
          ]
        }
      }
      Settings_Gateway = {
        transformation = {
          idFields = [
            "gatewayName",
          ]
          fieldsToHide = [
            {
              fieldName = "id"
              fieldType = "string"
            },
          ]
        }
      }
      Settings_Currency = {
        transformation = {
          idFields = [
            "currencyCode",
          ]
        }
      }
      Settings_PaymentTerm = {
        transformation = {
          idFields = [
            "type",
            "name",
          ]
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "string"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "id"
              fieldType = "string"
            },
          ]
        }
      }
      Settings_ReasonCode = {
        transformation = {
          idFields = [
            "reasonCodeTransactionType",
            "reasonCodeName",
          ]
          fieldsToHide = [
            {
              fieldName = "id"
              fieldType = "string"
            },
          ]
        }
      }
      Settings_RevenueEventType = {
        transformation = {
          idFields = [
            "systemId",
          ]
          fieldsToHide = [
            {
              fieldName = "id"
              fieldType = "string"
            },
          ]
        }
      }
      Settings_Segment = {
        transformation = {
          idFields = [
            "segmentName",
          ]
        }
      }
      Settings_SegmentationRule = {
        transformation = {
          fieldsToHide = [
            {
              fieldName = "id"
              fieldType = "string"
            },
          ]
        }
      }
      Settings_RuleDetail = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "segmentId"
              fieldType = "string"
            },
            {
              fieldName = "segmentName"
              fieldType = "string"
            },
            {
              fieldName = "transactionType"
              fieldType = "string"
            },
          ]
          fieldsToOmit = [
            {
              fieldName = "createdBy"
              fieldType = "string"
            },
            {
              fieldName = "createdOn"
              fieldType = "string"
            },
            {
              fieldName = "updatedBy"
              fieldType = "string"
            },
            {
              fieldName = "updatedOn"
              fieldType = "string"
            },
            {
              fieldName = "updatedById"
              fieldType = "string"
            },
            {
              fieldName = "CreatedDate"
              fieldType = "string"
            },
            {
              fieldName = "UpdatedDate"
              fieldType = "string"
            },
            {
              fieldName = "CreatedById"
              fieldType = "string"
            },
            {
              fieldName = "UpdatedById"
              fieldType = "string"
            },
            {
              fieldName = "nextPage"
              fieldType = "string"
            },
            {
              fieldName = "next"
              fieldType = "string"
            },
            {
              fieldName = "pagination"
            },
            {
              fieldName = "segmentId"
            },
          ]
        }
      }
      Settings_revenueRecognitionRuleDtos = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "revenueRecognitionRuleDtos"
              fieldType = "list<Settings_RevenueRecognitionRule>"
            },
          ]
        }
      }
      Settings_RevenueRecognitionRule = {
        transformation = {
          fieldsToHide = [
            {
              fieldName = "id"
              fieldType = "string"
            },
          ]
        }
      }
      Settings_CreditMemoTransactionRule = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "usedTheSameTransactionRuleAsCreditMemoItem"
              fieldType = "boolean"
            },
          ]
        }
      }
      Settings_Role = {
        transformation = {
          idFields = [
            "category",
            "name",
          ]
          fieldTypeOverrides = [
            {
              fieldName = "description"
              fieldType = "string"
            },
            {
              fieldName = "entityId"
              fieldType = "string"
            },
            {
              fieldName = "custom"
              fieldType = "boolean"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "id"
              fieldType = "string"
            },
          ]
        }
      }
      Settings_Attribute = {
        transformation = {
          fieldsToOmit = [
            {
              fieldName = "createdBy"
              fieldType = "string"
            },
            {
              fieldName = "createdOn"
              fieldType = "string"
            },
            {
              fieldName = "updatedBy"
              fieldType = "string"
            },
            {
              fieldName = "updatedOn"
              fieldType = "string"
            },
            {
              fieldName = "updatedById"
              fieldType = "string"
            },
            {
              fieldName = "CreatedDate"
              fieldType = "string"
            },
            {
              fieldName = "UpdatedDate"
              fieldType = "string"
            },
            {
              fieldName = "CreatedById"
              fieldType = "string"
            },
            {
              fieldName = "UpdatedById"
              fieldType = "string"
            },
            {
              fieldName = "nextPage"
              fieldType = "string"
            },
            {
              fieldName = "next"
              fieldType = "string"
            },
            {
              fieldName = "pagination"
            },
            {
              fieldName = "id"
              fieldType = "string"
            },
          ]
        }
      }
      Settings_Codes = {
        transformation = {
          idFields = [
            "code",
          ]
          fieldsToHide = [
            {
              fieldName = "id"
              fieldType = "string"
            },
          ]
        }
      }
      Settings_TaxCode = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "taxCompanyId"
              fieldType = "string"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "id"
              fieldType = "string"
            },
          ]
        }
      }
      Settings_TaxEngines = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "taxEngines"
              fieldType = "list<Settings_TaxEngine>"
            },
          ]
          standaloneFields = [
            {
              fieldName = "taxEngines"
            },
          ]
        }
      }
      Settings_TaxEngine = {
        transformation = {
          fieldsToHide = [
            {
              fieldName = "id"
              fieldType = "string"
            },
          ]
        }
      }
      Settings_TaxCompany = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "postalCode"
              fieldType = "string"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "id"
              fieldType = "string"
            },
          ]
        }
      }
      Settings_UnitOfMeasure = {
        transformation = {
          fieldsToHide = [
            {
              fieldName = "id"
              fieldType = "string"
            },
          ]
        }
      }
      Settings_DiscountSetting = {
        transformation = {
          fieldsToHide = [
            {
              fieldName = "id"
              fieldType = "string"
            },
          ]
        }
      }
      Settings_RolesPage = {
        request = {
          url = "/settings/user-roles"
          queryParams = {
            size = "100"
            page = "0"
          }
          paginationField = "page"
        }
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "content"
              fieldType = "list<Settings_Role>"
            },
          ]
          dataField = "content"
        }
      }
      Settings_WorkflowObject = {
        request = {
          url = "/settings/workflows/v1/{workFlowId}"
          dependsOn = [
            {
              pathParam = "workFlowId"
              from = {
                type = "Workflows"
                field = "id"
              }
            },
          ]
        }
      }
      Settings_CommunicationProfile = {
        transformation = {
          fieldTypeOverrides = [
            {
              fieldName = "id"
              fieldType = "string"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "id"
              fieldType = "string"
            },
          ]
        }
      }
      Settings_AllNotifications = {
        request = {
          url = "/settings/communication-profiles/{id}/notifications"
          dependsOn = [
            {
              pathParam = "id"
              from = {
                type = "Settings_CommunicationProfiles"
                field = "id"
              }
            },
          ]
        }
        transformation = {
          dataField = "."
        }
      }
      Settings_Notification = {
        transformation = {
          idFields = [
            "eventName",
            "name",
            "profileId",
          ]
          fieldTypeOverrides = [
            {
              fieldName = "calloutPreemptiveAuth"
              fieldType = "boolean"
            },
            {
              fieldName = "useCustomRequestBody"
              fieldType = "boolean"
            },
          ]
          fieldsToHide = [
            {
              fieldName = "id"
              fieldType = "string"
            },
            {
              fieldName = "eventId"
              fieldType = "string"
            },
            {
              fieldName = "emailTemplate"
              fieldType = "string"
            },
          ]
        }
      }
      Settings_HostedPaymentPage = {
        transformation = {
          fieldsToHide = [
            {
              fieldName = "id"
              fieldType = "string"
            },
          ]
        }
      }
      Settings_AccountingRules = {
        transformation = {
          isSingleton = true
        }
      }
      Settings_BillingCycleType = {
        transformation = {
          isSingleton = true
        }
      }
      Settings_BillingListPriceBase = {
        transformation = {
          isSingleton = true
        }
      }
      Settings_BillingPeriod = {
        transformation = {
          isSingleton = true
        }
      }
      Settings_BillingPeriodStart = {
        transformation = {
          isSingleton = true
        }
      }
      Settings_BillingRules = {
        transformation = {
          isSingleton = true
        }
      }
      Settings_ChargeModel = {
        transformation = {
          isSingleton = true
        }
      }
      Settings_ChargeType = {
        transformation = {
          isSingleton = true
        }
      }
      Settings_DocPrefix = {
        transformation = {
          isSingleton = true
        }
      }
      Settings_FxCurrency = {
        transformation = {
          isSingleton = true
        }
      }
      Settings_NumberAndSku = {
        transformation = {
          isSingleton = true
        }
      }
      Settings_PaymentMethods = {
        transformation = {
          isSingleton = true
        }
      }
      Settings_PaymentRules = {
        transformation = {
          isSingleton = true
        }
      }
      Settings_RevenueRecognitionModels = {
        transformation = {
          isSingleton = true
        }
      }
      Settings_RevenueRecognitionStatus = {
        transformation = {
          isSingleton = true
        }
      }
      Settings_RevenueStartDate = {
        transformation = {
          isSingleton = true
        }
      }
      Settings_SubscriptionSetting = {
        transformation = {
          isSingleton = true
        }
      }
    }
    supportedTypes = {
      AccountingCodeItem = [
        "AccountingCodes",
      ]
      AccountingPeriod = [
        "AccountingPeriods",
      ]
      ProductType = [
        "CatalogProduct",
      ]
      CustomObject = [
        "CustomObject",
      ]
      StandardObject = [
        "StandardObject",
      ]
      EventTrigger = [
        "EventTriggers",
      ]
      HostedPage = [
        "HostedPages",
      ]
      PublicNotificationDefinition = [
        "NotificationDefinitions",
      ]
      PublicEmailTemplate = [
        "NotificationEmailTemplates",
      ]
      PaymentGatewayResponse = [
        "PaymentGateways",
      ]
      SequenceSet = [
        "SequenceSets",
      ]
      WorkflowExport = [
        "WorkflowExport",
      ]
      Settings_AccountingRules = [
        "Settings_AccountingRules",
      ]
      Settings_Bucket = [
        "Settings_AgingBucket",
      ]
      Settings_Notification = [
        "Settings_AllNotifications",
      ]
      Settings_PaymentTerm = [
        "Settings_AllPaymentTerms",
      ]
      Settings_Codes = [
        "Settings_AllRevenueRecognition",
      ]
      Settings_TaxCode = [
        "Settings_AllTaxCode",
      ]
      Settings_ApplicationRules = [
        "Settings_ApplicationRules",
      ]
      Settings_SingleAlias = [
        "Settings_BatchAlias",
      ]
      Settings_BillingCycleType = [
        "Settings_BillingCycleType",
      ]
      Settings_BillingListPriceBase = [
        "Settings_BillingListPriceBase",
      ]
      Settings_BillingPeriod = [
        "Settings_BillingPeriod",
      ]
      Settings_BillingPeriodStart = [
        "Settings_BillingPeriodStart",
      ]
      Settings_BillingRules = [
        "Settings_BillingRules",
      ]
      Settings_ChargeModel = [
        "Settings_ChargeModel",
      ]
      Settings_ChargeType = [
        "Settings_ChargeType",
      ]
      Settings_CommunicationProfile = [
        "Settings_CommunicationProfiles",
      ]
      Settings_Currency = [
        "Settings_Currencies",
      ]
      Settings_DiscountSetting = [
        "Settings_DiscountSettings",
      ]
      Settings_DocPrefix = [
        "Settings_DocPrefix",
      ]
      Settings_FxCurrency = [
        "Settings_FxCurrency",
      ]
      Settings_TaxCompany = [
        "Settings_GetTaxCompanies",
      ]
      Settings_Segment = [
        "Settings_GlSegments",
      ]
      Settings_HostedPaymentPage = [
        "Settings_HostedPaymentPages",
      ]
      Settings_NumberAndSku = [
        "Settings_NumberAndSku",
      ]
      Settings_Gateway = [
        "Settings_PaymentGateways",
      ]
      Settings_PaymentMethods = [
        "Settings_PaymentMethods",
      ]
      Settings_PaymentRetryRules = [
        "Settings_PaymentRetryRules",
      ]
      Settings_PaymentRules = [
        "Settings_PaymentRules",
      ]
      Settings_ReasonCode = [
        "Settings_ReasonCodes",
      ]
      Settings_RevenueEventType = [
        "Settings_RevenueEventTypes",
      ]
      Settings_RevenueRecognitionModels = [
        "Settings_RevenueRecognitionModels",
      ]
      Settings_RevenueRecognitionRule = [
        "Settings_revenueRecognitionRuleDtos",
      ]
      Settings_RevenueRecognitionStatus = [
        "Settings_RevenueRecognitionStatus",
      ]
      Settings_RevenueStartDate = [
        "Settings_RevenueStartDate",
      ]
      Settings_Role = [
        "Settings_RolesPage",
      ]
      Settings_RuleDetail = [
        "Settings_SegmentationRules",
      ]
      Settings_SubscriptionSetting = [
        "Settings_SubscriptionSetting",
      ]
      Settings_UnitOfMeasure = [
        "Settings_UnitsOfMeasureList",
      ]
      Settings_TaxEngine = [
        "Settings_TaxEngines",
      ]
    }
  }
}
```
