# Zuora Billing adapter

Zuora Billing read-only adapter for salto.io


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
./e2e_test/cred_store register zuora-billing 'my-credentials-id' --baseUrl='https://rest.SANDBOX_SUBDOMAIN.zuora.com' --clientId='MYCLIENTID' --clientSecret='MYCLIENTSECRET'
```

Enter `--help` to see other uses for the `cred-store` utility - listing, removing and managing sets of credentials.
