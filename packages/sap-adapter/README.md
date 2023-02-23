# SAP adapter

SAP read-only adapter for salto.io

Salto helps you keep track of the main configuration entities for SAP Support in areas such as ticket management and customization (fields, forms, dynamic content, schedules, routing, …), business rules (views, triggers, macros, automations, SLA policies), account configuration (account settings, groups and agent roles, brands, locales, etc) and more.

We do this using the [SAP REST API](<https://developer.sap.com/api-reference/>).

## Configuring your SAP account for Salto OAuth Authentication
Salto supports authenticating with SAP using either a combination of user-name and password, or using OAuth authentication. In order to use OAuth authentication, please follow the steps below.
- Create a new "OAuth Client" in your SAP account (see [details](https://developer.sap.com/documentation/ticketing/working-with-oauth/creating-and-using-oauth-tokens-with-the-api/#create-an-oauth-client))
	- Under "Redirect URL", write `http://localhost:PORT`, where `PORT` is a port you can allow salto to open momentarily on your computer (it will not be open to external connections). Except for PORT, do not change any character in the URL.
- You can now connect your SAP account using OAuth credentials, by adding the flag `-a oauth` or `--auth-type oauth` to the commands `salto account add sap` or `salto account login sap`
- You will be asked to provide the following parameters:
  - Client ID of the OAuth Client
  - The generated Client Secret
  - The Port you provided in the redirect URL
  - Your SAP account subdomain.

## Known limitations
* Sunshine APIs (including custom objects) are not yet supported. Please reach out if interested.
* Many resources do not have strong uniqueness requirements in SAP, so we made some assumptions in order to effectively compare environments. If your account has resources with identical names or titles (e.g. two views with the same title), these elements may receive the same ID and be omitted from the workspace as a result. 
  * If you have such name overlaps and would still like to manage these elements with Salto, it is possible to adjust the configuration in order to support that. Please reach out if interested.

## E2E tests

E2E tests need real SAP credentials to run.

### Using a specific set of credentials

Add the following environment variables to bash_profile:
```bash
export SAP_USERNAME='XXXX'
export SAP_PASSWORD='XXXX'
export SAP_SUBDOMAIN='XXXX'
```

### Using the shared credentials pool

The credentials pool can be used to run the E2E tests concurrently on multiple SAP accounts.

The pool is used if the `SAP_` environment variables are not defined. You can also force its use by defining the environment variable `USE_CRED_POOL=1`.

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
./e2e_test/cred_store register sap 'my-credentials-id' --username='my@user.com' --password='MYPASSWORD' --subdomain='acme'
```

Enter `--help` to see other uses for the `cred-store` utility - listing, removing and managing sets of credentials.
