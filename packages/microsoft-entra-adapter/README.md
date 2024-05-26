# Microsoft Entra adapter

Microsoft Entra adapter for salto.io

Supports Microsoft Entra ID service, using the Microsoft Graph API.

Authentication is done using OAuth2.0. For more information see [specific-cli-options.md](specific-cli-options.md)

## Configure your account for OAuth authentication

1. Register an app in your Entra Admin Center by following [this guide](https://learn.microsoft.com/en-us/graph/auth-register-app-v2#register-an-application). Under the Redirect URI section please select 'Web' and set the redirect URI to `http://localhost:PORT`, where `PORT` is a port you will use to authenticate.
2. Add a client secret to your app by following [this guide](https://learn.microsoft.com/en-us/graph/auth-register-app-v2#option-2-add-a-client-secret).
