# Deploy tests using HTTP request recordings

This directory contains recordings of HTTP requests and responses that can be used to test the Okta adapter deployment.

HTTP recording files are created by:
1. Manually running a similar deployment with the CLI while saving the CLI log to a file (use the `SALTO_LOG_FILE` environment variable for this)
2. Extracting the HTTP requests and responses from the log (HTTP requests for deploy actions are automatically logged)
   and saving them to a file in this directory - see below for instructions
3. Modifying the recording file to:
   - Remove any sensitive information (e.g. API keys, Okta client secrets)
   - Replace any dynamic values (usually Okta generated IDs) with placeholders that are easier to read


## Extracting HTTP requests and responses from the log

Use the following script:

```shell
python3 ../salto-okta-deploy-upgrade/packages/adapter-components/scripts/client/mock_replies_nock.py \
  parse \
  <log file path> \
  <path to your git repo>/packages/okta-adapter/test/mock_replies/<type name>_<test case>.json \
  --pretty
```
