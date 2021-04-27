# Zuora Billing adapter

Zuora Billing read-only adapter for salto.io

## Connecting to your Zuora account
Salto authenticates with Zuora using [OAuth v2.0](https://www.zuora.com/developer/api-reference/#section/Authentication/OAuth-v2.0). If you do not have one already, follow the steps to:
- Create [an API user role and an API user](https://knowledgecenter.zuora.com/Billing/Tenant_Management/A_Administrator_Settings/Manage_Users/Create_an_API_User)
- Add an [OAuth client](https://knowledgecenter.zuora.com/Billing/Tenant_Management/A_Administrator_Settings/Manage_Users#Create_an_OAuth_Client_for_a_User) for your API user - by going to Administration -> Manage Users -> (choose the user) -> OAuth Clients -> create (and keep the client ID and secret shown on screen)

When logging in with Salto, you will be asked to provide:
- The OAuth client ID and secret
- The subdomain for your account (can be copied from the URL in the browser - for example, for https://sandbox.na.zuora.com/ the subdomain is sandbox.na)

## E2E tests

E2E tests need real Zuora credentials to run.

### Using a specific set of credentials

Add the following environment variables to bash_profile:
```bash
export ZA_BASE_URL='XXXX'
export ZA_CLIENT_ID='XXXX'
export ZA_CLIENT_SECRET='XXXX'
```

### Using the shared credentials pool

The credentials pool can be used to run the E2E tests concurrently on multiple Zuora accounts.

The pool is used if the `ZA_` environment variables are not defined. You can also force its use by defining the environment variable `USE_CRED_POOL=1`.

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
./e2e_test/cred_store register zuora_billing 'my-credentials-id' --baseURL='https://rest.SANDBOX_SUBDOMAIN.zuora.com' --clientId='MYCLIENTID' --clientSecret='MYCLIENTSECRET'
```

Enter `--help` to see other uses for the `cred-store` utility - listing, removing and managing sets of credentials.
