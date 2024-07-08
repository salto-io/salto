# Jamf adapter

Jamf adapter for salto.io

## Connecting Salto to Jamf

Salto supports authenticating with Jamf using a client secret and clientId:

- Go to https://learn.jamf.com/en-US/bundle/jamf-pro-documentation-current/page/API_Roles_and_Clients.html
- Create new client secret and clientId, and make sure to give admin site permissions
- Connect to Jamf with the command 'salto account add jamf' or 'salto account login jamf'.
- You will be asked to provide base URL (e.g. https://your-domain.jamfcloud.com), the clientId, and client secret you created.
