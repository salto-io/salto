# Zendesk Support adapter

Zendesk Support read-only adapter for salto.io

Salto helps you keep track of the main configuration entities for Zendesk Support in areas such as ticket management and customization (fields, forms, dynamic content, schedules, routing, …), business rules (views, triggers, macros, automations, SLA policies), account configuration (account settings, groups and agent roles, brands, locales, etc) and more.

We do this using the [Zendesk REST API](<https://developer.zendesk.com/api-reference/>).

## Configuring your Zendesk account for Salto OAuth Authentication
Salto supports authenticating with Zendesk using either a combination of user-name and password, or using OAuth authentication. In order to use OAuth authentication, please follow the steps below.
- Create a new "OAuth Client" in your Zendesk account (see [details](https://developer.zendesk.com/documentation/ticketing/working-with-oauth/creating-and-using-oauth-tokens-with-the-api/#create-an-oauth-client))
	- Under "Redirect URL", write `http://localhost:PORT`, where `PORT` is a port you can allow salto to open momentarily on your computer (it will not be open to external connections). Except for PORT, do not change any character in the URL.
- You can now connect your Zendesk account using OAuth credentials, by adding the flag `-a oauth` or `--auth-type oauth` to the commands `salto service add zendesk_support` or `salto service login zendesk_support`
- You will be asked to provide the following parameters:
  - Client ID of the OAuth Client
  - The generated Client Secret
  - The Port you provided in the redirect URL
  - Your Zendesk account subdomain.

## Known limitations
* Sunshine APIs (including custom objects) are not yet supported. Please reach out if interested.
* Many resources do not have strong uniqueness requirements in Zendesk, so we made some assumptions in order to effectively compare environments. If your account has resources with identical names or titles (e.g. two views with the same title), these elements may receive the same ID and be omitted from the workspace as a result. 
  * If you have such name overlaps and would still like to manage these elements with Salto, it is possible to adjust the configuration in order to support that. Please reach out if interested.