# Okta adapter

Okta adapter for salto.io

## Connecting Salto to Okta

Salto supports authenticating with Okta using an API Token:

- Go to https://{yourOktaDomain}.okta.com/admin/access/api/tokens
- Create a new token
- Connect to Okta with the command 'salto account add okta' or 'salto account login okta'.
- You will be asked to provide the Okta Base URL (e.g. https://<something>.okta.com/, remove the "-admin" part if exists) and the token you created.

## Okta Swaggers

The Okta adapter is heavily relying on [Core Okta API](https://developer.okta.com/docs/reference/core-okta-api/) and its [API swagger definitions](https://github.com/okta/okta-management-openapi-spec/blob/master/resources/spec.yaml).
