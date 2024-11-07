# Deploy tests using HTTP request recordings

This directory contains recordings of HTTP requests and responses that can be used to test the Okta adapter deployment.

Create HTTP recording files with the following steps:

## 1. Manually run similar deployment with the CLI

Make an actual change similar to the one you want to test using the CLI and save the CLI log to a file:

- Use the `SALTO_LOG_FILE=<log file path>` environment variable to write the log to a file
- Use the `SALTO_LOG_LEVEL=trace` environment variable to make sure all HTTP requests and responses are logged

For example:

```shell
SALTO_LOG_FILE=log.txt SALTO_LOG_LEVEL=trace salto deploy
```

HTTP requests are truncated in the log file if they are too long. Usually we don't reach this limit for small changes
intended for testing, but if you do, you can allow full HTTP logging without truncation by updating the adapter NaCL and
adding the "log all" configuration -

```hcl
client = {
   logging = {
      responseStrategies = [
         {
            pattern = ".*"
            strategy = "full"
         },
      ]
   }
}
```

## 2. Extract the HTTP requests and responses from the log

Use the following script:

```shell
python3 packages/adapter-components/scripts/client/mock_replies_nock.py \
  parse \
  <log file path> \
  packages/okta-adapter/test/mock_replies/<type name>_<test case>.json \
  --pretty
```

## 3. Clean up the recording file

Go through the recording file and:

- Remove any sensitive information (e.g. API keys, Okta client secrets)
- Replace any dynamic values (usually Okta generated IDs) with placeholders that are easier to read
