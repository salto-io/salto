# Salesforce adapter

Salesforce adapter for salto.io

## Configuring your Salesforce account for Salto OAuth Authentication

Salto supports authenticating with Salesforce using either a combination of user-name, password and token, or using OAuth authentication. In order to use OAuth authentication, please follow the steps below as you will need to create a new "Connected App" in your Salesforce account.

- Go to your salesforce account's setup screen
- Go to "App Manager", and click "New Connected App"
- Fill mandatory fields (Connected App Name, Api Name, Contact Email), then check "Enable Oauth Settings"
  - Under "callback URL", write http://localhost:PORT, where PORT is a port you can allow salto to open momentarily on your computer (it will not be open to external connections). Except for PORT, do not change any character in the URL.
  - Under "Selected OAuth Scopes", pick Full access (full) & Perform requests at any time (refresh_token, offline_access)
  - Save the app, and wait as the connected app creation instructs you
- You can now connect to salesforce with OAuth credentials, by adding the flag '-a oauth' or '--auth-type oauth' to the commands 'salto account add salesforce' or 'salto account login salesforce'
- You will be asked to provide the consumerKey created in the connected app and the port you provided in the callback URL

## E2E tests

E2E tests need real SFDC credentials to run - a free developer account is good enough.

- Register and login to your account at <https://developer.salesforce.com/>
- [Add a security token (aka API token)](https://help.salesforce.com/articleView?id=user_security_token.htm), or make sure your IP address is trusted.

### Using a specific set of credentials

Add the following environment variables to bash_profile:

```bash
export SF_USER='XXXX'
export SF_PASSWORD='XXXX'
export SF_TOKEN='XXXX'
```

### Using the shared credentials pool

The credentials pool can be used to run the E2E tests concurrently on multiple SFDC accounts.

The pool is used if the `SF_` environment variables are not defined. You can also force its use by defining the environment variable `USE_CRED_POOL=1`.

#### AWS credentials for the pool

The pool uses Amazon DynamoDB, and needs read/write/list permissions for the `e2e_permissions` table.

Make sure your [AWS credentials are set](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html), e.g, as environment variables:

```bash
export AWS_ACCESS_KEY_ID='XXXX'
export AWS_SECRET_ACCESS_KEY='XXXX'
```

#### Managing the pool using CLI

To add your credentials to the pool, use the `cred-store` CLI located at the `e2e_test` directory of the project:

```bash
./e2e_test/cred_store register salesforce 'my-credentials-id' --username='myuser@mydomain.com' --password='MYPASSWORD' --api-token='MYAPITOKEN'
```

Enter `--help` to see other uses for the `cred-store` utility - listing, removing and managing sets of credentials.
