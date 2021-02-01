# NetSuite Specific CLI options
## Partial Fetch
Salto CLI allows the user to fetch only specific netsuite configuration elements and/or file cabinet items by appending the below CLI parameters following the ```-C``` CLI option:

| Name                           | Default when undefined  | Description
| -------------------------------| ------------------------| -----------
| netsuite.fetchTarget.filePaths                          | fetch all cabinet files                     | A list of regexes of cabinet file paths. Any file whose path matches any of the regexes will be fetched
| netsuite.fetchTarget.types.[type_name]                      | fetch all records of all types                      | A list of script id regexes. Only records of ```type_name``` with matching script ids will be fetched. 

### Examples
**Fetch only 2 address forms identified by script ids ```custform_2_t1440050_248``` and ```custform_7_2239021_592```:**

```bash
salto fetch -C 'netsuite.fetchTarget.types.addressForm=["custform_2_t1440050_248", "custform_7_2239021_592"]'
```

**Fetch all entity custom fields:**

```bash
salto fetch -C 'netsuite.fetchTarget.types.entitycustomfield=[".*"]'
```

**Fetch specific file cabinet entiries:**
```bash
salto fetch -C 'netsuite.fetchTarget.filePaths=["/path/to/first/file", "/path/to/second/file"]'
```

**Fetch all files with a ```.js``` suffix under a specific directory:**
```bash
salto fetch -C 'netsuite.fetchTarget.filePaths=["/path/to/dir/.*\.js"]'
```

**Fetch all email templates and entry forms:**
```bash
salto fetch -C 'netsuite.fetchTarget.types.emailtemplate=[".*"]' -C 'netsuite.fetchTarget.types.entryForm=[".*"]'
```
