# Netsuite adapter

Netsuite adapter for salto.io

### Prerequisites
###### taken from https://github.com/oracle/netsuite-suitecloud-sdk/tree/master/packages/node-cli

Install Java 11 (OpenJDK / JDK)
```
OpenJDK - http://jdk.java.net/archive/ (explanation at https://dzone.com/articles/installing-openjdk-11-on-macos)
JDK - https://www.oracle.com/java/technologies/javase-jdk11-downloads.html
```

#### M1 Macs
If you have an M1 mac, you'll need to use homebrew to install the JDK,
```shell
$ brew install openjdk@11
```
After installing, make sure you create the symlink as homebrew suggests:
```
sudo ln -sfn /opt/homebrew/opt/openjdk@11/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-11.jdk
```
and then follow [the instructions](https://dzone.com/articles/installing-openjdk-11-on-macos) on how to set the current java version using `java_home`.
### Build instructions
```
yarn
yarn build
```

## Configure your Netsuite account to work with Salto
* Enable SDF in Your NetSuite Account (Admin Only) - follow the instructions under https://<ACCOUNT_ID>.app.netsuite.com/app/help/helpcenter.nl?fid=section_4724921034.html
* Setup Your Role (prefer Administrator) for SDF Development - follow the instructions under https://<ACCOUNT_ID>.app.netsuite.com/app/help/helpcenter.nl?fid=subsect_1539287603.html

### Limitations
Deleting record of CustomTypes & FileCabinet is not supported.


## E2E tests

E2E tests need real NetSuite credentials to run.

### Using a specific set of credentials

Add the following environment variables to bash_profile:
```bash
export NS_ACCOUNT_ID='XXXX'
export NS_TOKEN_ID='XXXX'
export NS_TOKEN_SECRET='XXXX'
```

### Using the shared credentials pool

The credentials pool can be used to run the E2E tests concurrently on multiple NetSuite accounts.

The pool is used if the `NS_` environment variables are not defined. You can also force its use by defining the environment variable `USE_CRED_POOL=1`.

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
./e2e_test/cred_store register netsuite 'my-credentials-id' --accountId='tstdrv1234567' --tokenId='MYTOKENID' --tokenSecret='MYTOKENSECRET'
```

Enter `--help` to see other uses for the `cred-store` utility - listing, removing and managing sets of credentials.
