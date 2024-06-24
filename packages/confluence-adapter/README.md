# Confluence adapter

Confluence adapter for salto.io

## Connecting Salto to Confluence

Salto supports authenticating with Atlassian Confluence using a user email and an API Token:

- Go to https://id.atlassian.com/manage-profile/security/api-tokens
- Create a new token
- Connect to Confluence with the command 'salto account add confluence' or 'salto account login confluence'.
- You will be asked to provide the Atlassian Base URL (e.g. https://acme.atlassian.net/), the user email, and the token you created.
