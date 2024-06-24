# NetSuite Specific CLI options

## Non interactive Login Parameters

Supprted parameters are:

- `accountId` - your netsuite account id
- `tokenId` - SDF token
- `tokenSecret` - SDF token secret

Optional params:

- `suiteAppTokenId` - Salto SuiteApp token id
- `suiteAppTokenSecret` - Salto SuiteApp token secret
- `suiteAppActivationKey` - Salto SuiteApp activation key

### Example

```
salto account add netsuite --login-parameters accountId=SomeAccountId tokenId=SomeTokenId tokenSecret=SomeTokenSecret
```

---

**Note**

Salto SuiteApp authentication params are relevant only in case it is installed in your netstuite account.

For more information about the salto suite app please visit https://www.suiteapp.com/Salto

If you would like to install the Salto SuiteApp in your netsuite account, please contact Salto support team from https://www.salto.io/ or by sending an email to support@salto.io

---

## Fetch Target

Salto CLI allows the user to fetch only specific netsuite configuration elements and/or file cabinet items by appending the `netsuite.fetchTarget.filePaths` and `netsuite.fetchTarget.types.[type_name]` parameters following the `-C` CLI option.
When none of the `fetchTarget` parameters is specified, Salto will fetch all configuration elements.

| Name                                         | Description                                                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **_netsuite.fetchTarget.filePaths_**         | A list of regular expressions of cabinet file paths. Only files with matching paths will be fetched                |
| **_netsuite.fetchTarget.types.[type_name]_** | A list of script id regular expressions. Only records of type `type_name` with matching script ids will be fetched |

### Examples

**Fetch only 2 address forms identified by script ids `custform_2_t1440050_248` and `custform_7_2239021_592`:**

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

**Fetch all files with a `.js` suffix under a specific directory:**

```bash
salto fetch -C 'netsuite.fetchTarget.filePaths=["/path/to/dir/.*\.js"]'
```

**Fetch all email templates and entry forms:**

```bash
salto fetch -C 'netsuite.fetchTarget.types.emailtemplate=[".*"]' -C 'netsuite.fetchTarget.types.entryForm=[".*"]'
```

## Changes Detection

When using `fetchTarget`, given the Salto SuiteApp credentials, Salto will attempt to detect the elements that were changed in the service and fetch only them.

| Name                               | Description                                                     |
| ---------------------------------- | --------------------------------------------------------------- |
| **_netsuite.useChangesDetection_** | Whether to fetch only changed elements when using `fetchTarget` |

### Examples

Disable changes detection

```bash
salto fetch -C 'netsuite.fetchTarget.types.addressForm=[".*"]' -C 'netsuite.useChangesDetection=false'
```
