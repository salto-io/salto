# Salesforce Specific CLI options

## Non interactive Login Parameters

Supprted parameters are:

- `username`
- `password`
- `token` - API token
- `sandbox` - true/false

### Example

```
salto account add salesforce --login-parameters username=user@company.com password=SomePasswd token=SomeApiToken sandbox=false
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

#### Dont Run Any Tests:

```bash
salto deploy -C 'salesforce.client.deploy.checkOnly=true' -C 'salesforce.client.deploy.testLevel=NoTestRun'
```

### Quick Deploy

In order to deploy a recent validation in Salto (quick deploy), you should use the requestId and the hash from your successful validation:

```bash
salto deploy -C 'salesforce.client.deploy.quickDeployParams.requestId=0Af8d00000KXQadCAH' -C 'salesforce.client.deploy.quickDeployParams.hash=c7113af43567b3da5af22025a06a17cdcb6bf3a1'
```
