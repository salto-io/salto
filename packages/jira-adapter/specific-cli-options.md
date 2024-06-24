# Jira Specific CLI options

## Non interactive Login Parameters

Supprted parameters are:

- `baseUrl` - e.g. https://\<mysubdomain\>.atlassian.net/
- `user` - Email address
- `token`

### Example

```
salto account add jira --login-parameters baseUrl=https://someSubDomain.atlassian.net/ user=SomeUSer token=SomeApiToken
```

## Force Delete

Allow to delete data that Salto won't be able to restore. Currently only relevant for deleting projects with issues

### Example

```bash
salto deploy -C 'jira.deploy.forceDelete=true'
```
