# Salesforce Specific CLI options

## Non interactive Login Parameters
Supprted parameters are:
* `username`
* `password`
* `token` - API token
* `sandbox` - true/false

### Example
```
salto service add salesforce --login-parameters username=user@company.com password=SomePasswd token=SomeApiToken sandbox=false
```

## Fetch Targets (Partial Fetch)
The salesforce adapter implements "partial fetch" support by allowing to fetch specific metadata types.

### Examples
```bash
salto fetch -C 'salesforce.fetch.target=["CustomObject", "Layout", "Workflow"]'
```

## Deploy Flags
There is configuration for how the salesforce adapter deploys changes to salesforce.
Some of it can be configured in the adapter configuration file, and some parameters should be set for a specific deploy

### Examples
#### Run All Local Tests:
```bash
salto deploy -C 'salesforce.client.deploy.checkOnly=true' -C 'salesforce.client.deploy.testLevel=RunLocalTests'
```

#### Run Specific Tests:
```bash
salto deploy -C 'salesforce.client.deploy.checkOnly=true' -C 'salesforce.client.deploy.testLevel=RunSpecifiedTests' -C 'salesforce.client.deploy.runTests=["TestName1", "TestName2"]'
```

