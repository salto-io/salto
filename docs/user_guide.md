# User Guide

# What's Salto?

Salto allows you to manage your business applications' configuration in code. By doing so, it enables modern devops style methodologies for development, testing and deployment for these business applications.

Salto consists of 3 main components:

1. The NaCl language — a declarative configuration language (follows the syntax of [hcl](https://github.com/hashicorp/hcl/tree/hcl2)), specifically designed to describe the configuration of modern business applications.
2. The salto command line interface — a tool which uses NaCl files to manage the configuration of business applications, with operations such as `deploy` (to deploy configuration changes to a business application) and `fetch` (to fetch the latest state of a business application into NaCl files). This tool is composed of a core processing engine, and various adapters to interact with the different business applications.
3. The salto vs-code extension — An extension to the popular vs-code IDE to easily interact with NaCl files.

Currently, Salto supports the following business applications:

- [Salesforce](https://github.com/salto-io/salto/tree/master/packages/salesforce-adapter)
- [HubSpot](https://github.com/salto-io/salto/tree/master/packages/hubspot-adapter)

Support for other business applications is in the works.

>Throughout this guide, we will use the terms "business applications" and "services" interchangeably

---

# **Getting started**

## Salto CLI Installation instructions

### Install Binary

The easiest way to install Salto's command line interface (CLI)  is by downloading its latest binary from <link> per your operating system type (MacOS / Linux / Windows). TODO: fix link!

Once you've downloaded the binary, it is advised to copy it somewhere safe and add it to your path.

For example, on Mac / Linux (using bash) one could do (TODO fix link):

```shell
mkdir ~/salto
curl https://salto.io/binaries/latest/mac/salto --output ~/salto/salto
echo "export PATH=$PATH:~/salto" >> ~/.bash_profile
```

Alternatively, you can also just download and copy the binary using other standard tools, and manually edit the PATH per your OS's instructions.

### Upgrade Instructions

The easiest way to upgrade Salto's CLI is to download a new version and replace the old version in place. Do note that currently the Salto CLI does not guarantee backward compatibility of any sort.

### Build From Source

Please refer to [https://github.com/salto-io/salto](https://github.com/salto-io/salto) for build from source instructions (routinely tested on MacOS and Linux, should also work on Windows).

## Quick Start

>Examples for CLI interactions throughout the guide assume you're in a **unix style shell** (e.g. on Mac or Linux). In case you're using some other shell on Windows, please make sure to make the required adjustments.

We will walk you through `initiating` a new Salto `workspace`, adding a service to it, `fetching` the current configuration from the service, making a change to it and `deploying` the change back to the service.

This quick start guide assumes you have credentials for a `Salesforce` dev account (for the sake of the example). If not, either do the relevant adaptations for the business application you would like to interact with, or open a Salesforce developer account at <LINK>.

### Create a new Salto workspace

First, we'll create a new Salto workspace to store all the Salto NaCl files which represent the configuration of the service we'll start managing using Salto.

In your home directory, please run:

```shell
mkdir quickstart
cd quickstart
salto init
```

This will create a new directory named `quickstart` in your home directory which will serve as the `workspace` for this project. Inside this directory, a `salto.config` directory was created, with some salto configuration files — no need to worry about these for now. Also, you probably noticed that `salto init` prompted for a name for the "first environment", you can just accept the default for now.

### Add a new service to the workspace

Next, we'll connect this workspace to a Salesforce account, by running:
```shell
salto services add salesforce
```

This command will prompt you to enter the credentials for your account, please do so.

<img src="/salto-io/salto/raw/master/docs/salto_service_add.png" alt="salto service add" style="max-width:70%;">

### Fetch the configuration from your business application to the workspace

Now, we will fetch the current configuration of the connected salto account into this workspace by running:

```shell
salto fetch
```

This might take a minute or two, after it your workspace will contain a bunch of .nacl files which correspond to your account's configuration!

Now, if you'll make any changes in your Salesforce account (e.g. try to add a custom object or a custom field to an existing object definition) and run `fetch` again, you will see that only those changes are detected and get merged back into the NaCl files.

### Deploy changes to the service

Next, we're going to do some changes in the configuration files and deploy them to service. Specifically, we're going to add a custom field to Salesforce's lead object.

Use your favorite editor to open `salesforce/Objects/Lead/LeadCustomFields.nacl` and insert the following lines at the end of the file in such a way that the last closing bracket '}' is just below them:

```hcl
salesforce.Text saltoQuickStartField {
     length = 32
}
```

This `element` describes your intent to add a new text field named "saltoQuickStartField" with a length of 32 characters to Lead.

Next, run:
```shell
salto deploy
```

Salto will analyze the actions required to perform in order to deploy your changes, and will prompt you to approve these operations. Review the changes, and approve them:

<img src="/salto-io/salto/raw/master/docs/salto_deploy.png" alt="salto deploy" style="max-width:70%;">

Now, log in into Salesforce's UI, and validate that the relevant field was added.

You can also run `salto fetch` again, to fetch some changes which were auto-generated by Salesforce when this field was added.

## Using Salto with Git

Typically, a Salto workspace maps to a Git repository. Once you have an initial Salto workspace, you would usually run `git init` to create a new git repository. Then you would run `git add .` to add all the currently fetched files (note that your salto state-files will be saved in the repo!) and `git commit` to record the baseline of your workspace to the repository.

From now on, you can use standard Git commands to record changes, create feature-branches for development work, revert to old versions, compare versions, etc. If you use a platform like GitHub, you can also utilize features like pull requests to perform code reviews and enforce checks on your repository (see [here](https://help.github.com/en/github/administering-a-repository/configuring-protected-branches)).

## Advanced Concepts

### References

In some cases, it is useful to reference one element from another. Such references can be introduced by the adapter, or by the user when manually editing NaCl files.

A reference is done to a `Salto ID`, which conforms with the following schema:

```html
    <adapter>.<type>.attr.<name>[.<key>...]
    <adapter>.<type>.field.<name>[.<key>...]
    <adapter>.<type>.instance.<name>[.<key>...]
```

For example, if we want to define that the value of a certain field will reference the value of another field, we could write :

```hcl
valueSet = salesforce.StandardValueSet.instance.LeadSource.standardValue
```

>In the case you need to reference a specific element in a list, you should use the index as an additional key, e.g. `salesforce.Lead.field.MyField__c.valueSet.2.fullName` would access the fullName attribute of the 2nd element in the list valueSet under the custom field MyField__c which is part of salesforce.Lead

>A reference implies a creation dependency between a source and a target element. Meaning that when element A references element B it also implies that Salto will make sure to create element B before element A is created.

### Multiple Environments

In a typical feature development process, multiple environments are being used. E.g. a feature is developed in a development environment, gets tested in a testing environment and once approved deployed to a production environment. When doing so, it is of very high importance to keep the configuration of these environments as similar as possible in order to ensure a consistent and safe change process.

In Salto, `environments` are first-level citizens, which also enable the encapsulation of commonalities and differences between service accounts. Before showing some examples for working with environments, we should first explain some common terms and operations:

- An `environment` is a collection of `services`.
- Salto calculates the `common` configuration of all the environments, as well as the `environment-specific` configuration.
- A `fetch` operation can work in `isolated mode` , when it will not modify common configuration, or in standard (non-isolated) mode when it will recalculate the common configuration. As a rule of thumb, `isolated mode` should be used when running fetch for the first time on a new service in an environment, and in standard mode when developing features (as the assumption is that the intent of the user is to eventually deploy the fetched changes to the other environments).

Now, let's follow a common scenario of adding two environments to salto:
```shell
salto init
```

Note that you've been prompted to give a name for the the first environment in the workspace. You can just accept the "env1" value, or choose the name of your liking (we'll use `prod` for this example)

Next, we'll continue similarly to quick-start by adding a service and running fetch:

```shell
salto services add salesforce
# provide credentials to your "prod" instance
salto fetch
```

Next we will add another environment (`dev`) by running:
```shell
salto env create dev
```

Note that creating this env, also changed the current env to be `dev` (see `salto env current`, `salto env set`, `salto env list`). You should always make sure to run commands in the context of the right env (see also the —env flag per command)

Now we'll configure this environment to connect to a `dev` instance (e.g. a Salesforce sandbox synched with `prod`) and run fetch:

```shell
salto services add salesforce
# provide credentials to your "dev" instance
salto fetch
```

Lets stop and take a look at our workspace directory structure (for more info see [here](#workspace-directory-structure)):
```shell
— salto.config/
- envs/                  # folder for env specific configuration
    — dev/               # folder for the dev environment specific configuration
	    — salesforce/    # specific config for Salesforce in the dev env
    — prod/              # folder for the prod environment specific configuration
	    — salesforce/    # specific config for Salesforce in the prod env
— salesforce/            # common cross-all-envs configuration for Salesforce
```
Now, in a normal feature development flow we would do some changes to the dev env (e.g. by changing it directly in the service and running `fetch` (normal mode)), or by changing the **common** configuration and deploying to dev. After all tests in dev are done, we can go ahead and run:
```shell
salto env set prod
salto deploy
```

Good luck! You've just pushed your first feature from dev to prod using Salto!

---

# Reference guide

## Salto CLI commands

### **salto init [workspace-name]**

Creates a new Salto workspace in the current directory

**Arguments**:

_workspace-name_ The name of the workspace [string]

### **salto fetch**

Syncs this workspace's NaCl files with the services' current state

**Options:**
* _--force, -f_ : Accept all incoming changes, even if there's a conflict with local changes [boolean] [default: false]
* _--interactive, -i_ : Interactively approve every incoming change [boolean] [default: false]
* _--isolated, -t_ : Restrict fetch from modifying common configuration (might result in changes in other env folders) [boolean] [default: false]
* _--services, -s_ : Specific services to perform this action for (default=all) [array]
* _--env, -e_ : The name of the environment to use

### **salto preview**

Shows Salto's execution plan next time deploy is run

**Options:**
* _--force, -f_ : Do not ask for approval if there are warnings in the workspace [boolean] [default: false]
* _--services, -s_ : Specific services to perform this action for (default=all) [array]
* _--env, -e_ : The name of the environment to use

### **salto deploy**

Deploys the current NaCl files config to the target services

**Options:**
* _--force, -f_ : Do not ask for approval before deploying the changes [boolean] [default: false]
* _--services, -s_ : Specific services to perform this action for (default=all) [array]
* _--env, -e_ : The name of the environment to use

### **salto services <command> [name]**

Manage your environments' services

**Arguments:**
* _command_ : The services management command [string] [required] [choices: "add", "login", "list"]
* _name_ : The name of the service [required for add & login] [string]

**Options:**

* _--env, -e_ : The name of the environment to use

### **salto env <command> [name]**

Manage your workspace environments

**Arguments:**
* _command_ : The environment management command [string] [required] [choices: "create", "set", "list", "current"]
* _name_ : The name of the environment (required for create & set) [string]

### *Generic Flags*

The following flags are available for all commands:

* _--version_ : Show version number
* _--help, -h_ : Show help
* _--verbose, -v_ : Output extra logs

## Workspace directory structure

The workspace is structured as follows:

- salto.config — all workspace specific internal salto files, including configuration and state files. See <LINK to Configuration> for more details
- Directory per adapter, named after the adapter (e.g. Salesforce, HubSpot) — NaCl definitions which are **common** across all defined environments which are configured per that adapter.
- envs -- inside envs, there is a directory per environment, named after the environment — NaCl definitions which are **specific** per environment. Each environment directory is also divided by adapter (which applies for that environment)

For example, a workspace with 3 environments (named dev, test and prod), each configured with both Salesforce and HubSpot would look like:
```shell
— salto.config/
- envs
    — dev/
        — salesforce/
        — hubspot/
    — test/
        — salesforce/
        — hubspot/
    — prod/
        — salesforce/
        — hubspot/
— salesforce/
— hubspot/
```

## Salto's configuration

Please see [Salto configuration](salto_configuration.md)

## NaCl language spec

A formal language specification is coming soon.

Till then, the basic syntax is mostly HCL2 ([https://github.com/hashicorp/hcl/tree/hcl2](https://github.com/hashicorp/hcl/tree/hcl2)) with some minor deviations.

## Salto Core annotations

Salto supports various annotations whose semantic is enforced by the tool itself, independent of the business application the relevant configuration element is mapped to.

- **_required** A boolean specifying whether the specific field value must be set or if it may be omitted when defining an instance or using it as a field in another type. Adapters may use this annotation whenever their target service supports the feature of required/optional fields.
- **_default** A default value that will be used in instances that do not explicitly define a value for the specific field.
- **_restriction** Can be used to define acceptable values for a particular field or type, accepts a complex value with (some of) the following fields:
    - **values** A list of allowed values for the field
    - **min** For number fields, the smallest allowed value
    - **max** For number fields, the greatest allowed value
    - **enforce_value** A boolean specifying whether the restriction should be enforced. when set to true, restriction violations will create warnings (this is the default behavior), when set to `false` a violation of this restriction will be ignored (the restriction is essentially disabled)
- **_depends_on** Can be used to explicitly define dependencies between blocks. Its value is a list of references, each reference marks that this block depends on the reference target
- **_parent** Can be used to explicitly define a relationship between blocks. Its value is a list of references, each reference marks that this block is a child of the reference target, unlike _depends_on, a parent relationship means the child block is assumed to be deleted automatically (by the service) when the parent is removed

## Salto builtin types

The following types are supported in the language:
| Name      | Example field definition | Example value  | Description
|-----------|--------------------------|----------------|------------
| `string`    | string name {}           | "me"           |
| `number`    | number age {}            | 12             |
| `boolean`   | boolean isOpen {}        | true / false   |
| `json`      | json value {}            | "{ \"a\": 12 }"| A string value that expects the value to be in JSON format
| `serviceid` | serviceid myid {}        | "ID"           | A string value that denotes an ID in the service (used by adapters to distinguish ID fields from other fields)
| `list`      | list<string> listField {}| ["a", "b", "c"]| A list of values. contains values of a specific type
| `set`       | Coming soon!             |                | Coming soon!

## Glossary - Coming Soon!

- Workspace
- NaCl
- Plan
- Service / BizApp
- Element
- Adapter
- Annotation
- Type
- Settings
- State file(s)
- Cache file(s)
- SALTO_HOME
- Environment

---

# Salto's Visual Studio Code extension

Please see [https://github.com/salto-io/salto/tree/master/packages/vscode](https://github.com/salto-io/salto/tree/master/packages/vscode) for instructions and details on the Salto VS-Code extension.
