# Microsoft Entra CLI options

## Non interactive Login Parameters

This adapter does not support non-interactive login. You can only authenticate using the OAuth2.0 flow.

## OAuth2.0 Login Parameters

First, please make sure your account is set up for OAuth2.0 authentication. See the [OAuth2.0 configure your account](README.md#configure-your-account-for-oauth-authentication) section in the main README.

Supported parameters are:

- `tenantId`
- `clientId`
- `clientSecret`
- `port` - the port you've set in the redirect URI

All the first three parameters are available in the app overview page for the app you've registered in the Entra Admin Center.

### Example

```bash
salto account add -a oauth microsoft_entra --login-parameters tenantId=SomeTenantId clientId=SomeClientId clientSecret=SomeClient port=SomePort
```
