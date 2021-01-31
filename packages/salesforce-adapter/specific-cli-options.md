# Salesforce Specific CLI options

The salesforce adapter supports several options that can be specified in certain salto operations via the `-C` parameter:

| Name                                 | Example value              | Relevant commands
| -----------------------------------  | -------------------------- | ------------------
| `salesforce.fetch.target`            | ["CustomObject", "Layout"] | `fetch`
| `salesforce.client.deploy.checkOnly` | true                       | `deploy`
| `salesforce.client.deploy.testLevel` | RunLocalTests              | `deploy`
<br>

## Fetch Target
The salesforce adapter implements "partial fetch" support by allowing to fetch specific metadata types.

### Examples
```bash
salto fetch -C 'salesforce.fetch.target=["CustomObject", "Layout", "Workflow"]'
```

## Deploy flags
There is configuration for how the salesforce adapter deploys changes to salesforce.
Some of it can be configured in the adapter configuration file, and some parameters should be set for a specific deploy

### Examples
```bash
salto deploy -C 'salesforce.client.deploy.checkOnly=true' -C 'salesforce.client.deploy.testLevel=RunLocalTests'
```
