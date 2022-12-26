# Zendesk CLI options

## Non interactive Login Parameters
Supprted parameters are:
* `username`
* `password`
* `baseUrl` - e.g. https://\<mysubdomain\>.zendesk.com/

### Example
```
salto account add zendesk --login-parameters username=SomeUsername password=SomePasswd baseUrl=https://someSubDomain.zendesk.com/
```
