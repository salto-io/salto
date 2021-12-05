# JIRA adapter

Atlassian JIRA adapter for salto.io

## Configuring your Jira account 

Salto supports authenticating with Atlassian Jira using a user email and an API Token:
- Go to https://id.atlassian.com/manage-profile/security/api-tokens 
- Create a new token
- Connect to Jira with the command 'salto service add jira' or 'salto service login jira'.
- You will be asked to provide the Atlassian Base URL (e.g. https://acme.atlassian.net/), the user email, and the token you created.
