# Google Workspace adapter

Google WS adapter for salto.io

## Authentication

### Basic Authentication

// not supported

### OAuth Authentication

OAuth authentication command:

```bash
salto account add -a oauth google_workspace

salto account login -a oauth google_workspace
```

The adapter also supports OAuth authentication. To authenticate using OAuth, use the `oauth` authentication method and follow the following steps:

1. Enable Oauth for your app by following the instructions [here](https://developers.google.com/identity/protocols/oauth2).
2. Set the `redirectUri` configuration parameter as `http://localhost:{port}/export`, where `port` is the port number you want to use.
3. Run the `salto account add ...` command and follow the instructions to authenticate using OAuth. You will need to provide the `clientId` and `clientSecret`, which you can obtain from the same page you create the Oauth and set the `redirectUri`, you can go to your google [console](https://console.cloud.google.com/) => `APIs & Services` => `Credentials` .
