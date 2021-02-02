# NetSuite Specific CLI options
## Fetch Target
Salto CLI allows the user to fetch only specific netsuite configuration elements and/or file cabinet items by appending the ```netsuite.fetchTarget.filePaths``` and ```netsuite.fetchTarget.types.[type_name]``` parameters following the ```-C``` CLI option.
When none of the ```fetchTarget``` parameters is specified, Salto will fetch all configuration elements.

| Name                           |  Description
| -------------------------------| ------------------------| -----------
| netsuite.fetchTarget.filePaths | A list of regular expressions of cabinet file paths. Only files with matching paths will be fetched.
| netsuite.fetchTarget.types.[type_name]  | A list of script id regular. Only records of type ```type_name``` with matching script ids will be fetched. 


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
