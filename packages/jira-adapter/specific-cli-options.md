# Jira Specific CLI options

| Name                           |  Description
| -------------------------------| ------------------------
| jira.deploy.forceDelete        |  Whether to allow deleting data that Salto won't be able to restore. Currently only relevant for deleting projects with issues


### Example

```bash
salto deploy -C 'jira.deploy.forceDelete=true'
```