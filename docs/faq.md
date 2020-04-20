# FAQ

## What is Salto?

Salto allows you to manage your business applications' configuration in code. By doing so, it enables modern devops style methodologies for development, testing and deployment for these business applications.

Salto consists of 3 main components:

1. The NaCl configuration language — a declarative configuration language (based on [hcl](https://github.com/hashicorp/hcl/tree/hcl2)), specifically designed to describe the configuration of modern business applications.
2. The Salto command line interface — a tool which uses NaCl files to manage the configuration of business applications, with operations such as `deploy` (to deploy configuration changes to a bizapp) and `fetch` (to fetch the latest state of a business application into NaCl files). This tool is composed of a core processing engine, and various adapters to interact with the different bizapps.
3. The Salto vs-code extension — An extension to the popular vs-code IDE to easily interact with NaCl files.

## Which services are supported?

Currently, Salto supports the following services:

- [Salesforce](https://github.com/salto-io/salto/tree/master/packages/salesforce-adapter)
- [HubSpot](https://github.com/salto-io/salto/tree/master/packages/hubspot-adapter)

Support for other services is in the works.

## How should I manage my service credentials?

Currently, service credentials are stored under your $SALTO_HOME directory (e.g. $HOME/.salto on MacOS), in the directory corresponding to the relevant workspace. We choose to store the credentials there by default in order to reduce the chances you'll check-in by mistake credentials in plaintext to your source control system.

In the future we're planning support for storing credentials in a secured shared location.

## What is Salto's License?

Salto is available under the Apache License, version 2.0.

## How can I contact you?

- Email us at <TODO> 
- Our public slack channel <TODO> 
- If you're looking to report a bug, file a feature request or contribute, please see [Contributing](contributing.md) .

## Does Salto collect any telemetry data?

While you can easily opt-out of sending any data, Salto does collect by default some telemetry data.
Please see [Telemetry](telemetry.md) for more information.

## I'm missing feature X, how can I tell you about it?

We would love to get your feedback! Please see [Contributing](contributing.md) for more information.

## I love Salto, how can I contribute?

Great question! Please see [Contributing](contributing.md) for more information.

## What's the meaning of the name Salto?

*Salto* in Italian and Spanish is a noun which most frequently means "jump" or "leap".

## What's NaCl?

NaCl stands for "Not Another Configuration Language", and is also the chemical formula of Sodium Chloride, which is more commonly known as table **salt**.

In our context, it is an [hcl](https://github.com/hashicorp/hcl/tree/hcl2) based declarative configuration language, with semantics purpose built to describe the configuration of business applications.