# Zendesk Support adapter

Zendesk Support read-only adapter for salto.io

Salto helps you keep track of the main configuration entities for Zendesk Support in areas such as ticket management and customization (fields, forms, dynamic content, schedules, routing, …), business rules (views, triggers, macros, automations, SLA policies), account configuration (account settings, groups and agent roles, brands, locales, etc) and more.

We do this using the [Zendesk REST API](<https://developer.zendesk.com/api-reference/>).

## Configuring your Zendesk account for Salto OAuth Authentication
Salto supports authenticating with Zendesk using either a combination of user-name and password, or using OAuth authentication. In order to use OAuth authentication, please follow the steps below.
- Create a new "OAuth Client" in your Zendesk account (see https://support.zendesk.com/hc/en-us/articles/4408845965210#topic_s21_lfs_qk)
	- Under "Redirect URL", write <http://localhost:PORT>, where PORT is a port you can allow salto to open momentarily on your computer (it will not be open to external connections). Except for PORT, do not change any character in the URL.
- You can now connect your Zendesk account using OAuth credentials, by adding the flag '-a oauth' or '--auth-type oauth' to the commands 'salto service add zendesk_support' or 'salto service login zendesk_support'
- You will be asked to provide the Client ID of the OAuth Client, the generated Client Secret, the port you provided in the redirect URL, and your Zendesk account subdomain.

## Known limitations
* Sunshine APIs (including custom objects) are not yet supported. Please reach out if interested.
* Many resources do not have strong uniqueness requirements in Zendesk, so in order to effectively compare environments some configuration changes may be needed. Please reach out if interested.
