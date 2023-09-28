# JIRA adapter

Atlassian JIRA adapter for salto.io

## Connecting Salto to Jira 

Salto supports authenticating with Atlassian Jira using a user email and an API Token:
- Go to https://id.atlassian.com/manage-profile/security/api-tokens 
- Create a new token
- Connect to Jira with the command 'salto account add jira' or 'salto account login jira'.
- You will be asked to provide the Atlassian Base URL (e.g. https://acme.atlassian.net/), the user email, and the token you created.

## Jira Swaggers

The Jira adapter is heavily relying on the [Atlassian JIRA Cloud platform](https://developer.atlassian.com/cloud/jira/platform/rest/v3/) and [Atlassian JIRA Software Cloud](https://developer.atlassian.com/cloud/jira/software/rest) API swagger definitions.
To make sure the adapter won't unexpectedly break due to a change in one of the swaggers. The adapter uses the swaggers [Jira Swaggers Repository](https://github.com/salto-io/jira-swaggers) which will contain the latest swagger version that this adapter was tested on.

## ScriptRunner onboarding for E2E servers
When starting a new E2E server there are several manual steps to perform before you can ran the tests
- Install the addons of ScriptRunner and ScriptRunner Behaviours
- Enter the ScriptRunner screens and advance through the survey until you can add an item (for instance in Scripted Fields)
- Enter the ScriptRunner Behavior screen and advance through the survey until you can add a behavior