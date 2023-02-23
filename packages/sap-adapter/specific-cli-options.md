# SAP CLI options

## Non interactive Login Parameters
Supprted parameters are:
* `clientId`
* `clientSecret`
* `subdomain`
* `production` - true/false

### Example
```
salto account add sap --login-parameters clientId=SomeClientId clientSecret=SomeClientSecret subdomain=SomeSubdomain production=false
```
