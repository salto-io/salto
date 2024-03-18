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

## Running Jira E2E

1. In your google account - go to [“AWS SSO”](https://accounts.google.com/AccountChooser/signinchooser?continue=https%3A%2F%2Faccounts.google.com%2Fo%2Fsaml2%2Finitsso%3Fidpid%3DC017078mt%26spid%3D348223541558%26forceauthn%3Dfalse%26from_login%3D1%26as%3DYx6XoVhSvv-tceibsGj1QkaQCSWrFbsUFvrNT1pyXK0&ltmpl=popup&btmpl=authsub&scc=1&oauth=1&theme=glif&flowName=GlifWebSignIn&flowEntry=AccountChooser).
2. Click on “AWS account”
3. Click on Salto → SaltoDevs - “**Command line or programmatic access”**
4. Copy the access token.
5. Paste the token in the terminal you run your e2e tests.
6. write the following command in your desired folder `yarn build && SALTO_LOG_FILE=logsalto.log SALTO_LOG_LEVEL=trace yarn e2e-test`
