## Salto CLI commands

### **salto init [workspaceName]**

Initialize a new Salto workspace in the current directory

**Arguments**:

`workspaceName` : The name of the workspace [string]

### **salto fetch**

Update the workspace configuration elements from the upstream services

**Options:**
* `--force, -f` :        Do not warn on conflicts with local changes [boolean] [default: false]
* `--interactive, -i` :  Interactively approve every incoming change [boolean] [default: false]
* `--state-only, --st` : Update just the state file and not the NaCLs [boolean] [default: false]
* `--services, -s` :     Specific services to perform this action for (default=all) [array]
* `--env, -e` :          The name of the environment to use
* `--mode, -m <mode>` :  Choose a fetch mode. Options - [default, align]

### **salto deploy**

Update the upstream services from the workspace configuration elements

**Options:**
* `--force, -f` :         Do not ask for approval before deploying the changes [boolean] [default: false]
* `--dry-run, -d` :       Print the execution plan without deploying [boolean] [default: false]
* `--detailed-plan, -p` : Print detailed plan including value changes [boolean] [default: false]
* `--services, -s` :      Specific services to perform this action for (default=all) [array]
* `--env, -e` :           The name of the environment to use


### **salto restore [element-selector..]**

Update the workspace configuration elements from the state file

**Arguments**:

`elementSelectors` : Array of configuration element patterns [array]

**Options:**
* `--force, -f` :                Do not warn on conflicts with local changes [boolean] [default: false]
* `--interactive, -i` :          Interactively approve every incoming change [boolean] [default: false]
* `--dry-run, -d` :              Preview the restore plan without making changes [boolean] [default: false]
* `--detailed-plan, -p` :        Print detailed changes including values [boolean] [default: false]
* `--list-planned-changes, -l` : Print a summary of the expected changes [boolean] [default: false]
* `--services, -s` :             Specific services to perform this action for (default=all) [array]
* `--env, -e` :                  The name of the environment to use [string]
* `--mode, -m <mode>` :          Choose a restore mode. Options - [default, align]

### **salto account \<command>**

Manage the environment services

**Commands:**
* `list`:                 List all environment application accounts

* `add <serviceType> [--account-name <account-name>]` :    Add an application account to an environment. This command will also login unless the `--no-login` is passed.

* `login <accountName>` :  Login to an application account of an environment

#### **Non Interactive Execution**

`account add` and `account login` commands are interactive by default.

Use the `--login-parameters` option in order to execute them in non interactive mode.

Supported login parameters per service type:
[salesforce](/packages/salesforce-adapter/specific-cli-options.md#non-interactive-login-parameters),
[netsuite](/packages/netsuite-adapter/specific-cli-options.md#non-interactive-login-parameters),
[jira](/packages/jira-adapter/specific-cli-options.md#non-interactive-login-parameters),
[workato](/packages/workato-adapter/specific-cli-options.md#non-interactive-login-parameters),
[stripe](/packages/stripe-adapter/specific-cli-options.md#non-interactive-login-parameters),
[zendesk](/packages/zendesk-adapter/specific-cli-options.md#non-interactive-login-parameters),
[zuora billing](/packages/zuora-billing-adapter/specific-cli-options.md#non-interactive-login-parameters)
[okta](/packages/okta-adapter/specific-cli-options.md#non-interactive-login-parameters),
[SAP](/packages/sap-adapter/specific-cli-options.md#non-interactive-login-parameters),

### **salto env \<command>**

Manage the workspace environments

**Commands:**
* `create <envName>` :                            Create a new environment in the workspace
* `list` :                                        List all workspace environments
* `current` :                                     Print the name of the current workspace environment
* `set <envName>` :                               Set a new current workspace environment
* `delete <envName>` :                            Delete a workspace environment
* `rename <oldName> <newName>` :                  Rename a workspace environment
* `diff <fromEnv> <toEnv> [elementSelector...]` : Compare two workspace environments

### **salto element \<command> \<element-selector..>**

Manage the workspace configuration elements

**Commands:**
* `move-to-common <elementSelector...>` :  Move env-specific configuration elements to the common configuration
* `move-to-envs <elementSelector...>` :    Move common configuration elements to env-specific configurations
* `clone <elementSelector...>` :           Clone elements from one env-specific configuration to others
* `list-unresolved` :                      Lists unresolved references to configuration elements
* `rename <sourceElementId> <targetElementId>`:  Rename an element (currently supporting InstanceElement only)

### Generic Flags

The following flags are available for all commands:

* `--version -V` :  Show version number
* `--help, -h` :    Show help
* `--verbose, -v` : Output extra logs
* `--config, -C` :  Override adapter configuration value. format: `<service>.<path>=<value>`<br>
  Can also be done by setting an environment variable named `SALTO_<service>_<path>=<value>`
