# salto

[![CircleCI](https://circleci.com/gh/salto-io/salto.svg?style=shield&circle-token=e64029d1886e2965a8d51b09597054b5a1e84733)](https://circleci.com/gh/salto-io/salto) &nbsp; &nbsp; [![codecov](https://codecov.io/gh/salto-io/salto/branch/master/graph/badge.svg?token=eCQVglnkeG)](https://codecov.io/gh/salto-io/salto) 

---

### TODO high-level description of the project's goal

### Build instructions

```
npm i
npm run build
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
| => npm install
| => npm run client -- <client args>
| => npm run client -- --help
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
