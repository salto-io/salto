# NetSuite CLI configuration
## Configuration example
```bash
salto fetch -C 'netsuite.fetchTarget.types.savedsearch=[".*"]' -C 'netsuite.fetchTarget.filePaths=["/Web Site Hosting Files.*"]'
```

## CLI Configuration options

| Name                                                | Default when undefined  | Description
| ----------------------------------------------------| ------------------------| -----------
| [fetchTarget](#fetch-target-configuration-options)  | undefined (fetch all)   | Specified items to fetch in the current fetch. Currently, when using this option, deletions won't be fetched from the service.


### Fetch Target configuration options
| Name                           | Default when undefined  | Description
| -------------------------------| ------------------------| -----------
| types                          | {}                      | A map of a type name to a list of regexes of script ids. Any object whose script id matches any of the regexes of its type will be fetched
| filePaths                      | []                      | A list of regexes of file paths. Any file whose path matches any of the regexes will be fetched