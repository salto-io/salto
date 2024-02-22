# Salto - Adapter API

---

API definitions and shared code for Salto Adapters.

## What are Salto Adapters?

A Salto Adapter is the piece of software responsible for integrating Salto with a specific service APIs in order to support the various Salto operations (e.g. `fetch`, `deploy`, etc.), as well as modeling a service configuration in NaCl.

## Build instructions

```
yarn ; yarn build
```

## Usage instructions

Add adapter-api to package.json: `yarn add @salto-io/adapter-api`
Run `yarn install`

import the needed modules from 'adapter-api'
