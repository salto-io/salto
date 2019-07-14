### TODO high-level description of the project's goal

### Build instructions

```
yarn
yarn run build
```

### Usage instructions

```
| => ./salto --help
Plan and apply changes using salto

Usage:
  salto [command]

Available Commands:
  apply       apply configuration changes
  describe    describe data model
  help        Help about any command

Flags:
  -h, --help      help for salto
  -v, --verbose   verbose report of the running operation

Use "salto [command] --help" for more information about a command.
```

### Dev Usage instructions

To run the cli without packaging:

```
| => yarn install
| => yarn run client -- <client args>
| => yarn run client -- --help
Usage: salto-cli [options] [command]

salto is a business operations as code tool, allowing one to manage all aspects of his business operations systems in code.

Options:
  -V, --version    output the version number
  -h, --help       output usage information

Commands:
  apply [options]  Applies the blueprints in the current working directory onto the related services.
  plan [options]   Shows the planned actions which will occur in the case of the next *apply* operation.
  discover         Generates blueprints and state files which represent the difference between the current state of the related services, and the configuration and state currently captured by salto.
  describe         Shows all available types and attributes for the adapters of the related services.

### TODO high-level architecture description

### Useful links

### TODO license
