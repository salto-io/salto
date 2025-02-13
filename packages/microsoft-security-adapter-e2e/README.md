# Microsoft Security adapter e2e

## E2E tests

E2E tests need real Microsoft Security credentials to run.

### Using a specific set of credentials

Add the following environment variables to bash_profile:

```bash
export MICROSOFT_SECURITY_TENANT_ID='XXXX'
export MICROSOFT_SECURITY_CLIENT_ID='XXXX'
export MICROSOFT_SECURITY_CLIENT_SECRET='XXXX'
export MICROSOFT_SECURITY_REFRESH_TOKEN='XXXX'
```

Then run the tests:

```bash
cd packages/microsoft-security-adapter-e2e
yarn e2e-test
```

### Using the shared credentials pool

The credentials pool can be used to run the E2E tests concurrently on predefined Microsoft Security accounts.

The pool is used if the `MICROSOFT_SECURITY_` environment variables are not defined. You can also force its use by defining the environment variable `USE_CRED_POOL=1`.

#### AWS credentials for the pool

The pool uses Amazon DynamoDB, and needs read/write/list permissions for the `e2e_permissions` table.

Make sure your [AWS credentials are set](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html), e.g, as environment variables:

```bash
export AWS_ACCESS_KEY_ID='XXXX'
export AWS_SECRET_ACCESS_KEY='XXXX'
```
