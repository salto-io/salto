# Google Workspace adapter

Google WS adapter for salto.io

## Authentication

### Basic Authentication

Basic authentication is not supported in google workspace. How ever we enabled the option to get use access token the was obtain with oauth.

### OAuth Authentication

OAuth authentication command:

```bash
salto account add -a oauth google_workspace

salto account login -a oauth google_workspace
```

The adapter also supports OAuth authentication. To authenticate using OAuth, use the `oauth` authentication method and follow the following steps:

1. Enable Oauth for your app by following the instructions [here](https://developers.google.com/identity/protocols/oauth2/web-server#creatingcred).
2. Set the `redirectUri` configuration parameter as `http://localhost:{port}/extract`, where `port` is the port number you want to use.
3. Enable These APIs [here](https://console.cloud.google.com/apis) =>`Enable APIS AND SERVICES`:
   1. `Admin SDK API`
   2. `Groups Settings API`
   3. `Cloud Identity API`
4. Adjust your reauthentication policy [here](https://admin.google.com/ac/security/reauth/admin-tools) to not require reauthentication.
   You can do it in 2 ways:
   1. Check the 'Never require authentication' checkbox.
   2. Never require authentication for a specific app:
      1. Under 'Require reauthentication' section, check the 'Exempt Trusted apps' checkbox and click OVERRIDE.
      2. Go to the [Apps Access Control](https://admin.google.com/ac/owl/list?tab=configuredApps) page.
      3. Click 'Add app' -> 'OAuth App Name Or Client ID'.
      4. Paste the client ID of the OAuth app you created in the first step and click 'search'.
      5. Select the app and check the relevant OAuth Client ID checkbox.
      6. Continue with the default scope.
      7. Under 'Access to Google Data' check the 'Trusted' checkbox and continue.
      8. View your configuration and click 'Finish'.
5. Run the `salto account add ...` command and follow the instructions to authenticate using OAuth. You will need to provide the `clientId` and `clientSecret`, which you can obtain from the same page you create the Oauth and set the `redirectUri`, you can go to your google [console](https://console.cloud.google.com/) => `APIs & Services` => `Credentials` .
