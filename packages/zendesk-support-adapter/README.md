# Zendesk Support adapter

Zendesk Support read-only adapter for salto.io

Salto helps you keep track of the main configuration entities for Zendesk Support in areas such as ticket management and customization (fields, forms, dynamic content, schedules, routing, …), business rules (views, triggers, macros, automations, SLA policies), account configuration (account settings, groups and agent roles, brands, locales, etc) and more.

We do this using the [Zendesk REST API](<https://developer.zendesk.com/api-reference/>).

**Known limitations:**
* Sunshine APIs (including custom objects) are not yet supported. Please reach out if interested.
* Many resources do not have strong uniqueness requirements in Zendesk, so in order to effectively compare environments some configuration changes may be needed. Please reach out if interested.
