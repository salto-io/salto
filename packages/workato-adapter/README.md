# Workato adapter

Workato read-only adapter for salto.io

Salto helps you keep track of the main Workato entities, including recipes, connections, custom properties and roles, as well as API clients, access profiles and collections.

**Recommendation:** If you have recipes that connect to Salesforce or Netsuite accounts, follow [the guide below](#identifying-dependencies-across-services) to view cross-service dependencies.

**Note:** We do not currently track the details of custom connectors, beyond the connections using them.

## Identifying dependencies across services

Workato recipes can connect entities across different business applications. If your Salto environment has a Netsuite or Salesforce adapter configured, you can see the dependencies by adding the following definition under the `fetch` section of your workato.nacl configuration file:

```
  fetch {
    ...
    serviceConnectionNames = {
      salesforce = [
        "Salesforce connection name",
      ]
      netsuite = [
        "Netsuite connection name",
      ]
    }
  }
```

Where:

- "Salesforce connection name" is the name of the Salesforce or Salesforce secondary connection that is connected to the Salesforce account configured in the current environment
- "Netsuite connection name" is the name of the Netsuite or Netsuite secondary connection that is connected to the Netsuite account configured in the current environment

Note that if multiple Workato connections are pointing to the same Salesforce/Netsuite account, they can all be listed.
