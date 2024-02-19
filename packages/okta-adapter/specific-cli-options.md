# Okta Specific CLI options

## Non interactive Login Parameters

Supprted parameters are:

- `baseUrl` - e.g. https://\<mysubdomain\>.okta.com/
- `token`

### Example

```
salto account add okta --login-parameters baseUrl=https://someSubDomain.okta.com/ token=SomeApiToken
```
