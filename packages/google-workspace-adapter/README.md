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
4. Run the `salto account add ...` command and follow the instructions to authenticate using OAuth. You will need to provide the `clientId` and `clientSecret`, which you can obtain from the same page you create the Oauth and set the `redirectUri`, you can go to your google [console](https://console.cloud.google.com/) => `APIs & Services` => `Credentials` .

Please notice - in order to log in with oauth to google workspace, we are using the refresh token. The refresh token only returns in the first request, so if you are already connected to your google workspace in your browser, you can open a guest tab and repeat the login.
