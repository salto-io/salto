# Salesforce fetch configuration

## Overview

Each business application connection in Salto has a configuration file per each environment or workspace linked it is added to. The configuration file allowes to customize the nature of the connection. The configuration file consists of 3 main sections:

- Fetch metadata: allowing to include and exclude specific metadata types in the fetch scope, such as [profiles and email templates](https://github.com/salto-io/salto/blob/main/packages/salesforce-adapter/fetch-config-doc.md#profiles).
- Fetch data: allowing to include data that would be fetched to Salto, for example to to support use-cases like [CPQ and Advanced Approvals](https://github.com/salto-io/salto/blob/main/packages/salesforce-adapter/cpq-sbaa-config-doc.md).
- Client: allowing to configure technical details like number of retries and timeouts of fetch.

In this guide we would focus on the first two, which allow us to control the scope of which elements are being fetched to Salto. You can copy paste these these configuration suggestions and use them for your Salesforce app connections.

## Default Salesforce configuration

Here’s the default Salesforce configuration:

<details>
<summary> Default Salesforce configuration </summary>

```hcl
salesforce {
  fetch = {
    metadata = {
      include = [
        {
          metadataType = ".*"
          namespace = ""
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
        },
        {
          metadataType = "ContentAsset"
        },
        {
          metadataType = "CustomObjectTranslation"
        },
        {
          metadataType = "StandardValueSet"
          name = "^(AddressCountryCode)|(AddressStateCode)$"
          namespace = ""
        },
        {
          metadataType = "ConnectedApp"
          name = "CPQIntegrationUserApp"
        },
      ]
    }
    fetchAllCustomSettings = false
  }
  maxItemsInRetrieveRequest = 2500
}
```

</details>

If you’d like to explore all supported configuration attributes, [check out this in-depth guide](https://github.com/salto-io/salto/edit/main/packages/salesforce-adapter/config_doc.md).

## Profiles

To enable fetching of profiles, copy paste the following configuration:

<details>
<summary> Salesforce profiles configuration </summary>

```hcl
salesforce {
  fetch = {
    metadata = {
      include = [
        {
          metadataType = ".*"
          namespace = ""
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
          metadataType = "SiteDotCom"
        },
        {
          metadataType = "EmailTemplate"
        },
        {
          metadataType = "ContentAsset"
        },
        {
          metadataType = "CustomObjectTranslation"
        },
        {
          metadataType = "StandardValueSet"
          name = "^(AddressCountryCode)|(AddressStateCode)$"
          namespace = ""
        },
        {
          metadataType = "ConnectedApp"
          name = "CPQIntegrationUserApp"
        },
      ]
    }
    fetchAllCustomSettings = false
  }
  maxItemsInRetrieveRequest = 2500
}
```

</details>

This configuration differs from the default one above by not having the 'Profiles' and 'PermissionSet' blocks in the exclude block, so they won't be excluded. Similarly, if you would like to enable fetching of email templates, you can remove the 'EmailTemplate' block.

## CPQ and Advanced Approvals with Salto

To learn more about CPQ and Advanced Approvals with Salto configurations, [click here](https://github.com/salto-io/salto/blob/main/packages/salesforce-adapter/cpq-sbaa-config-doc.md).
