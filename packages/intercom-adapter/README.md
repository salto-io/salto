# Intercom adapter

Intercom adapter for salto.io

## Operations

The Intercom adapter supports fetching data from Intercom using their public APIs.
Deploying changes to Intercom is currently not supported.

## Authentication

### Basic Authentication

Basic authentication command:

```bash
salto account [add | login] intercom
```

The adapter supports basic authentication using an access token. To authenticate using basic authentication, provide the access token in the `accessToken` configuration parameter.
You can generate an access token by following the instructions [here](https://developers.intercom.com/docs/build-an-integration/learn-more/authentication/#access-tokens).

### OAuth Authentication

OAuth authentication command:

```bash
salto account [add | login] -a oauth intercom
```

The adapter also supports OAuth authentication. To authenticate using OAuth follow the following steps:

1. Enable OAuth for your app by following the instructions [here](https://developers.intercom.com/docs/build-an-integration/learn-more/authentication/setting-up-oauth/#provide-the-initial-information).
2. Set the `redirectUri` configuration parameter as `http://localhost:{port}/export`, where `port` is the port number you want to use.
3. Run the above command in your salto workspace. You will need to provide the `clientId` and `clientSecret`, which you can obtain by following the instructions [here](https://developers.intercom.com/docs/build-an-integration/learn-more/authentication/#access-tokens).
