# Google Workspace configuration

## Configuration example

```hcl
google_workspace {
  fetch = {
    include = [
      {
        type = ".*"
      },
    ]
    exclude = [
      {
        type = "group"
        criteria = {
          name = "name.*"
        }
      },
    ]
  }
  deploy = {
    defaultDomain = "##PRIMARY##"
  }
}
```

## Fetch entry options

| Name                              | Default when undefined | Description                                                     |
| --------------------------------- | ---------------------- | --------------------------------------------------------------- |
| type                              | ""                     | A regex of the Salto type name to include in the entry          |
| [criteria](#fetch-entry-criteria) |                        | A List of criteria to filter specific instance of certain types |

### Deploy configuration options

| Name            | Default when undefined | Description                                                                                                                                                                          |
| --------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [defaultDomain] | ""                     | Configure replacement for deploying groups, you can choose under what domain to create the group. You can use `###PRIMARY###` in order to create the group under the primary domain. |
